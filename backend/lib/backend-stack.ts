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
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';

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

    table.addGlobalSecondaryIndex({
      indexName: 'GSI3',
      partitionKey: { name: 'GSI3PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI3SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ['Title', 'ResCount', 'MomentumScore', 'LastUpdatedAt', 'CreatedAt'],
    });

    // DLQ for X notifications
    const dlq = new sqs.Queue(this, `${envPrefix}NewThreadDLQ`, {
      queueName: `${envPrefix}Dai2ChannelNewThreadDLQ`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // SQS Queue for X notifications
    const newThreadQueue = new sqs.Queue(this, `${envPrefix}NewThreadQueue`, {
      queueName: `${envPrefix}Dai2ChannelNewThreadQueue`,
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: dlq,
      },
    });

    // Idempotency Store Table
    const idempotencyTable = new dynamodb.Table(this, `${envPrefix}IdempotencyStore`, {
      tableName: `${envPrefix}Dai2ChannelIdempotency`,
      partitionKey: { name: 'IdempotencyKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ExpiresAt',
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Connections Table for WebSocket
    const connectionsTable = new dynamodb.Table(this, `${envPrefix}ConnectionsTable`, {
      tableName: `${envPrefix}Dai2ChannelConnections`,
      partitionKey: { name: 'ConnectionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ExpiresAt',
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });
    connectionsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'ThreadId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });

    // Lambda Environment Variables
    const lambdaEnv: Record<string, string> = {
      TABLE_NAME: table.tableName,
      IDEMPOTENCY_TABLE_NAME: idempotencyTable.tableName,
      CONNECTIONS_TABLE_NAME: connectionsTable.tableName,
      QUEUE_URL: newThreadQueue.queueUrl,
      // Parameter Store Keys
      IP_HASH_SALT_PARAM: '/dai2channel/salt/ipHash',
      DAILY_ID_SALT_PARAM: '/dai2channel/salt/dailyId',
      TRIP_SALT_PARAM: '/dai2channel/salt/trip',
    };

    // S3 Bucket for Media Uploads
    const mediaBucket = new s3.Bucket(this, `${envPrefix}Dai2ChannelMediaBucket`, {
      bucketName: `${envPrefix.toLowerCase()}-dai2channel-media-${this.account}-${this.region}`,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.GET],
          allowedOrigins: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : ['http://localhost:5173'],
          allowedHeaders: ['*'],
        },
      ],
      publicReadAccess: true, // Allow public viewing of uploaded media
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
    });

    lambdaEnv['MEDIA_BUCKET_NAME'] = mediaBucket.bucketName;

    // Cognito User Pool for Accounts
    const userPool = new cognito.UserPool(this, `${envPrefix}Dai2ChannelUserPool`, {
      userPoolName: `${envPrefix}Dai2ChannelUserPool`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, `${envPrefix}Dai2ChannelUserPoolClient`, {
      userPool: userPool,
      authFlows: { userPassword: true, userSrp: true },
    });

    // Output Cognito Info
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });

    lambdaEnv['USER_POOL_ID'] = userPool.userPoolId;
    lambdaEnv['USER_POOL_CLIENT_ID'] = userPoolClient.userPoolClientId;
    lambdaEnv['ADMIN_EMAIL'] = 'yukiyakiyu854@icloud.com';

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

    const likeThreadLambda = new nodejs.NodejsFunction(this, `${envPrefix}LikeThreadFn`, {
      entry: 'src/handlers/likeThread.ts',
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

    const adminLambda = new nodejs.NodejsFunction(this, `${envPrefix}AdminFn`, {
      entry: 'src/handlers/adminHandler.ts',
      ...defaultNodejsProps,
    });

    const extendedLambda = new nodejs.NodejsFunction(this, `${envPrefix}ExtendedFn`, {
      entry: 'src/handlers/extendedHandler.ts',
      ...defaultNodejsProps,
    });

    const generatePresignedUrlLambda = new nodejs.NodejsFunction(this, `${envPrefix}GeneratePresignedUrlFn`, {
      entry: 'src/handlers/generatePresignedUrl.ts',
      ...defaultNodejsProps,
    });

    const wsConnectLambda = new nodejs.NodejsFunction(this, `${envPrefix}WsConnectFn`, {
      entry: 'src/handlers/wsConnect.ts',
      ...defaultNodejsProps,
    });

    const wsDisconnectLambda = new nodejs.NodejsFunction(this, `${envPrefix}WsDisconnectFn`, {
      entry: 'src/handlers/wsDisconnect.ts',
      ...defaultNodejsProps,
    });

    const wsDefaultLambda = new nodejs.NodejsFunction(this, `${envPrefix}WsDefaultFn`, {
      entry: 'src/handlers/wsDefault.ts',
      ...defaultNodejsProps,
    });

    // Grant Permissions
    table.grantReadWriteData(createThreadLambda);
    table.grantReadData(getThreadsLambda);
    table.grantReadData(getThreadLambda);
    table.grantReadWriteData(createPostLambda);
    table.grantReadWriteData(deletePostLambda);
    table.grantReadWriteData(likeThreadLambda);
    table.grantReadData(cronMomentumToXLambda);
    table.grantReadData(cronSummaryToXLambda);
    table.grantReadWriteData(adminLambda);
    table.grantReadWriteData(extendedLambda);

    idempotencyTable.grantReadWriteData(createThreadLambda);
    idempotencyTable.grantReadWriteData(createPostLambda);

    connectionsTable.grantReadWriteData(wsConnectLambda);
    connectionsTable.grantReadWriteData(wsDisconnectLambda);
    connectionsTable.grantReadData(createPostLambda);

    mediaBucket.grantPut(generatePresignedUrlLambda);

    const ssmPolicy = new cdk.aws_iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/dai2channel/*`],
    });
    adminLambda.addToRolePolicy(ssmPolicy);
    createPostLambda.addToRolePolicy(ssmPolicy);
    createThreadLambda.addToRolePolicy(ssmPolicy);

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
        allowOrigins: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token', 'Idempotency-Key'],
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
    const webSocketApi = new apigwv2.WebSocketApi(this, `${envPrefix}WebSocketApi`, {
      apiName: `${envPrefix} Dai2 Channel WebSocket API`,
      connectRouteOptions: { integration: new integrations.WebSocketLambdaIntegration('ConnectIntegration', wsConnectLambda) },
      disconnectRouteOptions: { integration: new integrations.WebSocketLambdaIntegration('DisconnectIntegration', wsDisconnectLambda) },
      defaultRouteOptions: { integration: new integrations.WebSocketLambdaIntegration('DefaultIntegration', wsDefaultLambda) },
    });
    const webSocketStage = new apigwv2.WebSocketStage(this, `${envPrefix}WebSocketStage`, {
      webSocketApi,
      stageName: 'prod',
      autoDeploy: true,
    });

    const connectionsArn = `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.apiId}/prod/*`;
    createPostLambda.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [connectionsArn],
    }));
    createPostLambda.addEnvironment('WEBSOCKET_ENDPOINT', webSocketStage.callbackUrl);

    new cdk.CfnOutput(this, 'WebSocketApiEndpoint', {
      value: webSocketStage.callbackUrl.replace('https://', 'wss://'),
      description: 'WebSocket API Endpoint URL',
    });

    // API Resources
    const threadsResource = api.root.addResource('threads');
    threadsResource.addMethod('GET', new apigateway.LambdaIntegration(getThreadsLambda));
    threadsResource.addMethod('POST', new apigateway.LambdaIntegration(createThreadLambda));

    const threadResource = threadsResource.addResource('{threadId}');
    threadResource.addMethod('GET', new apigateway.LambdaIntegration(getThreadLambda));

    const likeResource = threadResource.addResource('like');
    likeResource.addMethod('POST', new apigateway.LambdaIntegration(likeThreadLambda));

    const postsResource = threadResource.addResource('posts');
    postsResource.addMethod('POST', new apigateway.LambdaIntegration(createPostLambda));

    const postResource = postsResource.addResource('{postId}');
    postResource.addMethod('DELETE', new apigateway.LambdaIntegration(deletePostLambda));

    // Admin Routes
    const adminResource = api.root.addResource('admin');
    adminResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(adminLambda),
      anyMethod: true
    });

    // Extended Routes (tags, tickets, push)
    const tagsResource = api.root.addResource('tags');
    tagsResource.addMethod('GET', new apigateway.LambdaIntegration(extendedLambda));

    const ticketsResource = api.root.addResource('tickets');
    ticketsResource.addMethod('POST', new apigateway.LambdaIntegration(extendedLambda));
    const ticketResource = ticketsResource.addResource('{ticketId}');
    ticketResource.addMethod('GET', new apigateway.LambdaIntegration(extendedLambda));
    ticketResource.addResource('reply').addMethod('POST', new apigateway.LambdaIntegration(extendedLambda));

    const pushResource = api.root.addResource('push');
    pushResource.addResource('subscribe').addMethod('POST', new apigateway.LambdaIntegration(extendedLambda));

    const mediaResource = api.root.addResource('media');
    mediaResource.addResource('presigned').addMethod('GET', new apigateway.LambdaIntegration(generatePresignedUrlLambda));

    new cdk.CfnOutput(this, 'RestApiEndpoint', {
      value: api.url,
      description: 'REST API Endpoint URL',
    });
  }
}
