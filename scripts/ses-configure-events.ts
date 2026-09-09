/**
 * Prints AWS CLI to create an SES configuration set + SNS HTTPS destination.
 * Does not create AWS resources unless the operator copies and runs the commands.
 *
 *   npx tsx scripts/ses-configure-events.ts
 */
const REGION = process.env.AWS_SES_REGION || "us-east-1";
const SET = process.env.SES_CONFIGURATION_SET || "flap-outbound";
const TOPIC = "flap-ses-events";
const ENDPOINT = "https://useflap.online/api/inbound/ses/events";

console.log(`# Operator-only — review before running. Region=${REGION} set=${SET}
# 1) Configuration set
aws sesv2 create-configuration-set --configuration-set-name ${SET} --region ${REGION}

# 2) SNS topic
aws sns create-topic --name ${TOPIC} --region ${REGION}

# 3) Subscribe HTTPS (Worker confirms SubscribeURL after SNS signature checks)
#    Replace TOPIC_ARN with the create-topic output.
aws sns subscribe --topic-arn TOPIC_ARN --protocol https --notification-endpoint ${ENDPOINT} --region ${REGION}

# 4) Event destination: send, delivery, bounce, complaint, reject (no open/click)
#    Use the AWS console Event destination wizard if CLI event-destination JSON is awkward.
#    Destination: SNS topic TOPIC_ARN. Matching event types: SEND DELIVERY BOUNCE COMPLAINT REJECT.

# 5) Worker
#    wrangler secret put SES_CONFIGURATION_SET
#    value: ${SET}

# Do not enable open/click tracking unless product requires it.
`);
