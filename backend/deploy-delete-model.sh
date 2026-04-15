#!/bin/bash

RESOURCE_GROUP="rg-cwb-sj-planner"
ACCOUNT_NAME="spec-catcher"
DEPLOYMENT_NAME="gpt-4-1-mini-2025-04-14-ft-6c97fa76539f47b9af7c550c4468add3"
MODEL_NAME="gpt-4.1-mini-2025-04-14.ft-6c97fa76539f47b9af7c550c4468add3"
MODEL_VERSION="1"
MODEL_FORMAT="OpenAI"
SKU_NAME="GlobalStandard"
SKU_CAPACITY=10

deploy_model() {
    echo "Deploying Azure OpenAI deployment: $DEPLOYMENT_NAME..."
    az cognitiveservices account deployment create --model-format "$MODEL_FORMAT" \
                                               --model-name "$MODEL_NAME" \
                                               --model-version "$MODEL_VERSION" \
                                               --name "$ACCOUNT_NAME" \
                                               --resource-group "$RESOURCE_GROUP" \
                                               --sku-name "$SKU_NAME" \
                                               --sku-capacity "$SKU_CAPACITY" \
                                               --deployment-name "$DEPLOYMENT_NAME" \
    
    if [ $? -eq 0 ]; then
        echo "Deployed and ready for testing."
    else
        echo "Failed to deploy model."
    fi
}

delete_deployment() {
    echo "Deleting Azure OpenAI deployment: $DEPLOYMENT_NAME..."
    az cognitiveservices account deployment delete --name "$ACCOUNT_NAME" \
                                                  --resource-group "$RESOURCE_GROUP" \
                                                  --deployment-name "$DEPLOYMENT_NAME" \
    
    if [ $? -eq 0 ]; then
        echo "Deployment deleted - credits saved."
    else
        echo "Failed to delete deployment."
    fi
}

case "$1" in
    deploy)
        deploy_model
        ;;
    delete)
        delete_deployment
        ;;
    *)
        echo "Usage: $0 {deploy|delete}"
        exit 1
        ;;
esac