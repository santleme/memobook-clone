terraform {
  required_version = ">= 1.9"
  required_providers {
    azapi = {
      source  = "Azure/azapi"
      version = "~> 2.6"
    }
  }
  backend "local" {}
}

variable "subscription_id" { type = string }
variable "resource_group" { type = string }
variable "account_prefix" { type = string }
provider "azapi" { subscription_id = var.subscription_id }

variable "daily_request_limit" {
  type    = number
  default = 600
  validation {
    condition     = var.daily_request_limit >= 1 && floor(var.daily_request_limit) == var.daily_request_limit
    error_message = "Use a positive whole number of Azure requests per UTC day."
  }
}

output "app_config" {
  value = {
    daily_request_limit = var.daily_request_limit
    chat_endpoint       = azapi_resource.memobook_account["chat"].output.properties.endpoint
    chat_model          = azapi_resource.memobook_model["chat"].name
    voice_endpoint      = azapi_resource.memobook_account["voice"].output.properties.endpoint
    voice_model         = azapi_resource.memobook_model["voice"].name
  }
}

locals {
  regions = { chat = "eastus", voice = "eastus2" }
  models = {
    chat  = { name = "gpt-6.2-sol", version = "2026-11-17", capacity = 100 }
    voice = { name = "gpt-4o-mini-tts", version = "2025-12-15", capacity = 10 }
  }
}

resource "azapi_resource" "memobook_account" {
  for_each               = local.regions
  type                   = "Microsoft.CognitiveServices/accounts@2024-10-01"
  name                   = "${var.account_prefix}-${each.key}"
  parent_id              = "/subscriptions/${var.subscription_id}/resourceGroups/${var.resource_group}"
  location               = each.value
  response_export_values = ["properties.endpoint"]
  body = {
    kind = "OpenAI"
    sku  = { name = "S0" }
    properties = {
      customSubDomainName = "${var.account_prefix}-${each.key}"
    }
  }
}

resource "azapi_resource" "memobook_model" {
  for_each  = local.models
  type      = "Microsoft.CognitiveServices/accounts/deployments@2024-10-01"
  name      = each.value.name
  parent_id = azapi_resource.memobook_account[each.key].id
  body = {
    sku = { name = "GlobalStandard", capacity = each.value.capacity }
    properties = {
      model                = { format = "OpenAI", name = each.value.name, version = each.value.version }
      versionUpgradeOption = "NoAutoUpgrade"
    }
  }
}
