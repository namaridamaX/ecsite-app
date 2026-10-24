resource "aws_cognito_user_pool" "main" {
  name                     = "User pool - wqbljt"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  mfa_configuration        = "OFF"
  deletion_protection      = "ACTIVE"
  user_pool_tier           = "ESSENTIALS"
  password_policy {
    minimum_length                   = 8
    require_uppercase                = true
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }
  sign_in_policy {
    allowed_first_auth_factors = ["PASSWORD"]
  }
  admin_create_user_config {
    allow_admin_create_user_only = false
  }
  username_configuration {
    case_sensitive = false
  }
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
  }
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
    recovery_mechanism {
      name     = "verified_phone_number"
      priority = 2
    }
  }
  schema {
    name                     = "email"
    attribute_data_type      = "String"
    developer_only_attribute = false
    mutable                  = true
    required                 = true

    string_attribute_constraints {
      min_length = "0"
      max_length = "2048"
    }
  }
}

resource "aws_cognito_user_pool_client" "web" {
  user_pool_id           = aws_cognito_user_pool.main.id
  name                   = "ecsite-dev-web-client"
  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 5
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
  explicit_auth_flows                  = ["ALLOW_REFRESH_TOKEN_AUTH", "ALLOW_USER_AUTH", "ALLOW_USER_SRP_AUTH"]
  supported_identity_providers         = ["COGNITO"]
  callback_urls                        = ["https://kai-page.net/"]
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "phone"]
  allowed_oauth_flows_user_pool_client = true
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation              = true
  auth_session_validity                = 3
}

resource "aws_cognito_user_pool_domain" "main" {
  domain                = "ap-northeast-1252wz5iuo"
  user_pool_id          = aws_cognito_user_pool.main.id
  managed_login_version = 2
}