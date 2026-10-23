# IAM role that the review-personas GitHub workflow assumes through OIDC.
# It can call one Bedrock model and nothing else.

# The account already has GitHub's OIDC provider; look it up rather than create it.
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Only pull_request runs of this repo. Forks get no OIDC token.
    # Immutable IDs in the subject mean a deleted and re-created repo of the same name can't assume the role.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["${var.github_oidc_sub_prefix}:pull_request"]
    }
  }
}

data "aws_iam_policy_document" "invoke_model" {
  statement {
    effect    = "Allow"
    actions   = ["bedrock:InvokeModel"]
    resources = ["arn:aws:bedrock:${var.aws_region}::foundation-model/${var.model_id}"]
  }
}

resource "aws_iam_role" "review_personas" {
  name                 = var.role_name
  description          = "Assumed by the review-personas workflow in ${var.github_repo}"
  assume_role_policy   = data.aws_iam_policy_document.trust.json
  max_session_duration = 3600
}

resource "aws_iam_role_policy" "invoke_model" {
  name   = "bedrock-invoke-model"
  role   = aws_iam_role.review_personas.id
  policy = data.aws_iam_policy_document.invoke_model.json
}
