#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")"
state="$(cd .. && pwd)/.state"
mkdir -p "$state"
chmod 700 "$state"
export TF_DATA_DIR="$state/terraform-data"
export TF_VAR_subscription_id
TF_VAR_subscription_id=$(az account show --query id -o tsv)
: "${TF_VAR_resource_group:?Set the existing Azure resource group}"
: "${TF_VAR_account_prefix:?Set a globally unique Azure resource name prefix}"
echo "Selected Azure subscription: $TF_VAR_subscription_id" >&2
terraform init -backend-config="path=$state/terraform.tfstate" -input=false
terraform validate
terraform plan -out="$state/memobook.tfplan" -input=false
if [[ ${1:-plan} == apply ]]; then
  terraform apply -input=false "$state/memobook.tfplan"
  chmod 600 "$state/terraform.tfstate"
  if [[ -f "$state/terraform.tfstate.backup" ]]; then chmod 600 "$state/terraform.tfstate.backup"; fi
  tmp=$(mktemp "$state/cloud-config.XXXXXX")
  trap 'rm -f "$tmp"' EXIT
  for service in chat voice; do
    account="$TF_VAR_account_prefix-$service"
    az cognitiveservices account keys list -g "$TF_VAR_resource_group" -n "$account" --query key1 -o tsv > "$tmp"
    test -s "$tmp"
    mv "$tmp" "$state/azure-$service.key"
    tmp=$(mktemp "$state/cloud-config.XXXXXX")
  done
  terraform output -json app_config > "$tmp"
  mv "$tmp" "$state/azure.json"
fi
