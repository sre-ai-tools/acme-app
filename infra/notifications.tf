# SNS topics: SEV1 pages from the API (APP-7) and operational alarms (alarms.tf).
# Both are encrypted with a customer managed key: CloudWatch alarms can't publish to a topic
# encrypted with the AWS managed aws/sns key.

data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "sns_key" {
  statement {
    sid       = "AccountAdmin"
    actions   = ["kms:*"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }

  statement {
    sid       = "CloudWatchAlarms"
    actions   = ["kms:Decrypt", "kms:GenerateDataKey*"]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_kms_key" "sns" {
  description         = "${local.name} SNS topics"
  enable_key_rotation = true
  policy              = data.aws_iam_policy_document.sns_key.json
}

resource "aws_kms_alias" "sns" {
  name          = "alias/${local.name}-sns"
  target_key_id = aws_kms_key.sns.key_id
}

resource "aws_sns_topic" "sev1" {
  name              = "${local.name}-sev1"
  kms_master_key_id = aws_kms_key.sns.arn
}

resource "aws_sns_topic" "alarms" {
  name              = "${local.name}-alarms"
  kms_master_key_id = aws_kms_key.sns.arn
}

# Publishing only over TLS.
data "aws_iam_policy_document" "topic_tls_only" {
  for_each = { sev1 = aws_sns_topic.sev1.arn, alarms = aws_sns_topic.alarms.arn }

  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["sns:Publish"]
    resources = [each.value]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }

  statement {
    sid       = "AccountAccess"
    actions   = ["sns:Publish", "sns:Subscribe", "sns:GetTopicAttributes"]
    resources = [each.value]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }

  dynamic "statement" {
    for_each = each.key == "alarms" ? [1] : []
    content {
      sid       = "CloudWatchAlarms"
      actions   = ["sns:Publish"]
      resources = [each.value]
      principals {
        type        = "Service"
        identifiers = ["cloudwatch.amazonaws.com"]
      }
      condition {
        test     = "StringEquals"
        variable = "aws:SourceAccount"
        values   = [data.aws_caller_identity.current.account_id]
      }
    }
  }
}

resource "aws_sns_topic_policy" "sev1" {
  arn    = aws_sns_topic.sev1.arn
  policy = data.aws_iam_policy_document.topic_tls_only["sev1"].json
}

resource "aws_sns_topic_policy" "alarms" {
  arn    = aws_sns_topic.alarms.arn
  policy = data.aws_iam_policy_document.topic_tls_only["alarms"].json
}

# Email subscriptions are optional; each address must confirm before it receives messages.
resource "aws_sns_topic_subscription" "sev1_email" {
  for_each  = toset(var.sev1_emails)
  topic_arn = aws_sns_topic.sev1.arn
  protocol  = "email"
  endpoint  = each.value
}

resource "aws_sns_topic_subscription" "alarms_email" {
  for_each  = toset(var.alarm_emails)
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = each.value
}

# The Lambda has no internet route; it reaches SNS through an interface endpoint.
resource "aws_vpc_endpoint" "sns" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.sns"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.endpoints.id]
  private_dns_enabled = true
  policy              = data.aws_iam_policy_document.sns_endpoint.json

  tags = { Name = "${local.name}-sns" }
}

# Only this account's topics are reachable through the endpoint, so it can't be used to send
# data to a topic in another account.
data "aws_iam_policy_document" "sns_endpoint" {
  statement {
    actions   = ["sns:Publish"]
    resources = ["arn:aws:sns:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
  }
}
