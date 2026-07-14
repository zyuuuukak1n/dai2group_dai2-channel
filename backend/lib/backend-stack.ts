import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as logs from 'aws-cdk-lib/aws-logs';

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const isProd = this.node.tryGetContext('env') === 'prod';
    const envPrefix = isProd ? 'Prod' : 'Dev';

    // DynamoDB Table (Single Table Design)
    const table = new dynamodb.Table(this, `${envPrefix}Dai2ChannelTable`, {
      tableName: `${envPrefix}Dai2Channel`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ExpiresAt',
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ['Title', 'ResCount', 'MomentumScore', 'LastUpdatedAt', 'CreatedAt'],
    });

    table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ['Title', 'ResCount', 'MomentumScore', 'LastUpdatedAt', 'CreatedAt'],
    });

    // SQS Queue for X notifications
    const newThreadQueue = new sqs.Queue(this, `${envPrefix}NewThreadQueue`, {
      queueName: `${envPrefix}Dai2ChannelNewThreadQueue`,
    });

    // Lambda Environment Variables
    const lambdaEnv = {
      TABLE_NAME: table.tableName,
      QUEUE_URL: newThreadQueue.queueUrl,
      // We will reference the names of the SSM parameters here so the lambda can fetch them at runtime if needed,
      // but for simplicity we can also pass plain text salts as env vars for now.
      IP_HASH_SALT: 'ip-hash-salt-placeholder-replace-me',
      DAILY_ID_SALT: 'daily-id-salt-placeholder-replace-me',
      TRIP_SALT: 'trip-salt-placeholder-replace-me',
    };

    // Lambda Node.js Default Props
    const defaultNodejsProps: nodejs.NodejsFunctionProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      environment: lambdaEnv,
      logRetention: logs.RetentionDays.ONE_MONTH,
    };

    // Lambda Functions
    const createThreadLambda = new nodejs.NodejsFunction(this, `${envPrefix}CreateThreadFn`, {
      entry: 'src/handlers/createThread.ts',
      ...defaultNodejsProps,
    });

    const getThreadsLambda = new nodejs.NodejsFunction(this, `${envPrefix}GetThreadsFn`, {
      entry: 'src/handlers/getThreads.ts',
      ...defaultNodejsProps,
    });

    const getThreadLambda = new nodejs.NodejsFunction(this, `${envPrefix}GetThreadFn`, {
      entry: 'src/handlers/getThread.ts',
      ...defaultNodejsProps,
    });

    const createPostLambda = new nodejs.NodejsFunction(this, `${envPrefix}CreatePostFn`, {
      entry: 'src/handlers/createPost.ts',
      ...defaultNodejsProps,
    });

    const deletePostLambda = new nodejs.NodejsFunction(this, `${envPrefix}DeletePostFn`, {
      entry: 'src/handlers/deletePost.ts',
      ...defaultNodejsProps,
    });

    const sqsToXLambda = new nodejs.NodejsFunction(this, `${envPrefix}SqsToXFn`, {
      entry: 'src/handlers/sqsToX.ts',
      ...defaultNodejsProps,
    });

    const cronMomentumToXLambda = new nodejs.NodejsFunction(this, `${envPrefix}CronMomentumToXFn`, {
      entry: 'src/handlers/cronMomentumToX.ts',
      ...defaultNodejsProps,
    });

    const cronSummaryToXLambda = new nodejs.NodejsFunction(this, `${envPrefix}CronSummaryToXFn`, {
      entry: 'src/handlers/cronSummaryToX.ts',
      ...defaultNodejsProps,
    });

    // Grant Permissions
    table.grantReadWriteData(createThreadLambda);
    table.grantReadData(getThreadsLambda);
    table.grantReadData(getThreadLambda);
    table.grantReadWriteData(createPostLambda);
    table.grantReadWriteData(deletePostLambda);
    table.grantReadData(cronMomentumToXLambda);
    table.grantReadData(cronSummaryToXLambda);

    newThreadQueue.grantSendMessages(createThreadLambda);
    
    // Add SQS Event Source to sqsToXLambda
    sqsToXLambda.addEventSource(new cdk.aws_lambda_event_sources.SqsEventSource(newThreadQueue));

    // EventBridge Rules
    new events.Rule(this, `${envPrefix}MomentumRule`, {
      schedule: events.Schedule.cron({ minute: '0', hour: '8,12,16,20,23' }),
      targets: [new targets.LambdaFunction(cronMomentumToXLambda)],
    });

    new events.Rule(this, `${envPrefix}SummaryRule`, {
      schedule: events.Schedule.cron({ minute: '30', hour: '23' }),
      targets: [new targets.LambdaFunction(cronSummaryToXLambda)],
    });

    // API Gateway (REST API)
    const api = new apigateway.RestApi(this, `${envPrefix}Dai2ChannelApi`, {
      restApiName: `${envPrefix} Dai2 Channel API`,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
      },
    });

    // Rate Limiting (Usage Plan)
    const plan = api.addUsagePlan(`${envPrefix}UsagePlan`, {
      name: `${envPrefix}Dai2ChannelUsagePlan`,
      throttle: {
        rateLimit: 10,
        burstLimit: 20,
      },
    });
    plan.addApiStage({
      stage: api.deploymentStage,
    });

    // API Resources
    const threadsResource = api.root.addResource('threads');
    threadsResource.addMethod('GET', new apigateway.LambdaIntegration(getThreadsLambda));
    threadsResource.addMethod('POST', new apigateway.LambdaIntegration(createThreadLambda));

    const threadResource = threadsResource.addResource('{threadId}');
    threadResource.addMethod('GET', new apigateway.LambdaIntegration(getThreadLambda));

    const postsResource = threadResource.addResource('posts');
    postsResource.addMethod('POST', new apigateway.LambdaIntegration(createPostLambda));

    const postResource = postsResource.addResource('{postId}');
    postResource.addMethod('DELETE', new apigateway.LambdaIntegration(deletePostLambda));
  }
}
