import { Bucket, BucketPolicy, Construct, ILinkable, PolicyStatement, Resource, Root, Scope } from "./cdkv3";

/**
 * app1: create a bucket with no properties, set all properties via tweaks
 * 
 * The BucketPolicy is implicitly linked.
 */
function app1() {
  const root = new Root();

  new Bucket(root, 'Bucket', {}, [
    Bucket.BucketName('MyBucket'),
    Bucket.Tag('CostCenter', '1234'),

    new BucketPolicy(Scope.FLOATING, 'BucketPolicy', {}, [
      new PolicyStatement({
        actions: ['s3:GetObject'],
        principals: ['*'],
      }),
    ]),
  ]);
  return root;
}

/**
 * app2: create a bucket with tweaks, create an explicitly linked BucketPolicy
 * 
 * The PolicyStatement is still implicitly linked
 */
function app2() {
  const root = new Root();

  const bucket = new Bucket(root, 'Bucket', {}, [
    Bucket.BucketName('MyBucket'),
    Bucket.Tag('CostCenter', '1234'),
  ]);

  new BucketPolicy(bucket, 'BucketPolicy', {
    bucket: bucket,
  }, [
    new PolicyStatement({
      actions: ['s3:GetObject'],
      principals: ['*'],
    }),
  ]);

  return root;
}

/**
 * app3: Everything is explicitly linked
 */
function app3() {
  return Root.with(root => {
    const bucket = new Bucket(root, 'Bucket', {}, [
      Bucket.BucketName('MyBucket'),
      Bucket.Tag('CostCenter', '1234'),
    ]);

    const bucketPol = new BucketPolicy(bucket, 'BucketPolicy', {
      bucket: bucket,
    });

    new PolicyStatement({
      policyDocument: bucketPol.policyDocument,
      actions: ['s3:GetObject'],
      principals: ['*'],
    });
  });
}

function fancyBucket(scope: Construct, id: string, tweaks?: ILinkable[]) {
  return new Bucket(scope, id, {}, [
    Bucket.BucketName('MyBucket'),
    Bucket.Tag('CostCenter', '1234'),

    // This example needed the introduction of `Scope.FLOATING`, otherwise there wouldn't be a
    // way of comfortably combining Bucket and BucketPolicy together in a way that tweaks
    // would apply to both (except perhaps explicit nesting).
    // 
    // This requires cognitive overhead and is a bit nasty.
    new BucketPolicy(Scope.FLOATING, 'BucketPolicy'),

    ...tweaks ?? [],
  ]);
}

/**
 * app4: A function that returns "a bucket with an associated policy" that can be tweaked
 */
function app4() {
  return Root.with(root => 
    fancyBucket(root, 'Bucket', [
      new PolicyStatement({
        actions: ['s3:GetObject'],
        principals: ['*'],
      }),
    ]));
}

/**
 * app5: Use 'fancyBucket' but use an explicit link operation
 */
function app5() {
  return Root.with(root => {
    const b = fancyBucket(root, 'Bucket');
    b.link([
      new PolicyStatement({
        actions: ['s3:GetObject'],
        principals: ['*'],
      }),
    ]);
  });
}

const apps = [app1, app2, app3, app4, app5];
const rendered = apps.map((a) => [a.name, JSON.stringify(Resource.renderAll(a()), undefined, 2)]);

for (const [fn, r] of rendered) {
  if (r !== rendered[0][1]) {
    console.log(rendered[0][0], rendered[0][1]);
    console.log(fn, r);
    process.exitCode = 1;
  }
}