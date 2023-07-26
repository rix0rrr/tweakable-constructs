import { Construct, ILinkable, Linkable } from "./construct";
import { DerivedProperty, LinkableSlot, CollectionProperty, CollectionTweak, Resource, ScalarProperty, ScalarTweak, IRenderable, LinkingTweak } from "./core";

//////////////////////////////////////////////////////////////////////
// BUCKET

export interface BucketProps {
  readonly bucketName?: string;
  readonly tags?: Bucket.Tag[];
}

export class Bucket extends Resource {
  public static BucketName(name: string) {
    return new ScalarTweak('AWS::S3::Bucket', 'BucketName', name);
  }

  public static Tag(key: string, value: string) {
    return new CollectionTweak('AWS::S3::Bucket', 'Tags', { Key: key, Value: value });
  }

  public static LoggingConfigurationDestinationBucketName(name: string) {
    return new ScalarTweak('AWS::S3::Bucket', 'BucketName', name);
  }

  public static LoggingConfigurationLogFilePrefix(prefix: string) {
    return new ScalarTweak('AWS::S3::Bucket', 'BucketName', name);
  }

  constructor(scope: Construct, id: string, props?: BucketProps, linkables?: ILinkable[]) {
    super(scope, id, 'AWS::S3::Bucket');

    this.makeLinkableAs('AWS::S3::Bucket');
    this.addProperty('BucketName', new ScalarProperty());
    this.addProperty('LoggingConfiguration', new ScalarProperty());
    this.addProperty('Tags', new CollectionProperty());

    this.link([
      props?.bucketName ? Bucket.BucketName(props.bucketName) : undefined,
      ...(props?.tags ?? []).map(t => Bucket.Tag(t.key, t.value)),
      ...linkables ?? [],
    ]);
  }
}

export namespace Bucket {
  export interface Tag {
    readonly key: string;
    readonly value: string;
  }
}

//////////////////////////////////////////////////////////////////////
// BUCKETPOLICY

export interface BucketPolicyProps {
  readonly bucketName?: string;
}

export class BucketPolicy extends Resource implements ILinkable {
  public static BucketName(bucketName: string) {
    return new ScalarTweak('AWS::S3::BucketPolicy', 'BucketName', bucketName);
  }

  public static Bucket(bucket: Bucket) {
    return new ScalarTweak('AWS::S3::BucketPolicy', 'BucketName', bucket.ref);
  }

  public static AutomaticBucketName() {
    return new LinkingTweak('AWS::S3::BucketPolicy', (pol: BucketPolicy) => {
      pol.makeLinkableTo(['AWS::S3::Bucket'], (buck: Bucket) => {
        BucketPolicy.Bucket(buck).linkTo(pol);
      });
    });
  }

  public readonly policyDocument: PolicyDocument;

  constructor(scope: Construct, id: string, props?: BucketPolicyProps, links?: ILinkable[]) {
    super(scope, id, 'AWS::S3::BucketPolicy');

    this.makeLinkableAs('AWS::S3::BucketPolicy');

    this.addProperty('BucketName', new ScalarProperty(props?.bucketName));
    this.policyDocument = new PolicyDocument(this, 'PolicyDocument');
    this.addProperty('PolicyDocument', new ScalarProperty(this.policyDocument));

    this.link(links);
  }
}

//////////////////////////////////////////////////////////////////////
// POLICYDOCUMENT

export class PolicyDocument extends Construct implements IPolicyDocument, IRenderable {
  public readonly statements = new Array<PolicyStatement>();

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.makeLinkableAs('@aws-cdk/iam:PolicyDocument');
  }

  public render() {
    return {
      Version: '2012-10-12',
      Statement: this.statements.map(x => x.render()),
    };
  }

  public addStatement(statement: PolicyStatement): void {
    this.statements.push(statement);
  }
}

export interface IPolicyDocument {
  addStatement(statement: PolicyStatement): void;
}

function isPolicyDocument(x: any): x is IPolicyDocument {
  return x && typeof x === 'object' && (x as any).addStatement;
}


//////////////////////////////////////////////////////////////////////
// POLICYSTATEMENT

export interface PolicyStatementProps {
  readonly policyDocument?: IPolicyDocument;
  readonly actions?: string[];
  readonly effect?: string;
  readonly resources?: string[];
  readonly principals?: string[];
}

export class PolicyStatement implements ILinkable, IRenderable {
  public linksTo: string[] = ['@aws-cdk/iam:PolicyDocument'];

  constructor(private readonly props?: PolicyStatementProps) {
    // FIXME: This is duplicated with 'linkTo'
    if (props?.policyDocument) {
      props.policyDocument.addStatement(this);
    }
  }

  public linkTo(target: Construct): void {
    if (isPolicyDocument(target)) {
      target.addStatement(this);
    }
  }

  public render() {
    return {
      Effect: this.props?.effect ?? 'Allow',
      Action: this.props?.actions,
      Resource: this.props?.resources,
      Principal: this.props?.principals,
    };
  }

  public toString() {
    return `PolicyStatement(${JSON.stringify(this.props)})`;
  }
}