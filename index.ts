//#region -c demo imports
import { Bucket, BucketPolicy, Construct, ILinkable, PolicyStatement, Resource, Root, Scope } from "./cdkv3";
//#endregion

/**
 * ## Introduction
 * 
 * A different way of initializing constructs that combines setting resource properties
 * via values passed at resource construction time, and "modifiers" passed to constructs
 * that set properties after initial creation.
 * 
 * While the set of "initial properties" is the L1 set and cannot be extended by customer
 * code, the set of "modifiers" can be arbitrary extended, and higher-level modifiers
 * can be written.
 * 
 * ## Terminology
 * 
 * I haven't completely settled on terminology here. *Modifiers* are also alternatingly
 * called *tweaks* and *linkables* as well.
 */

/**
 * 
 * ## App0 - properties and explicit rooting
 * 
 * Everything is explicit, and initialization is done via properties.
 * 
 * `Root.with` is a bit of syntactic sugar -- it creates a construct root, calls a callback
 * on it, then returns it.
 */
function app0() {
  return Root.with((root) => {

    /**
     * Bucket creation is done purely via setting properties.
     */
    const bucket = new Bucket(root, 'Bucket', {
      bucketName: 'MyBucket',
      tags: [{ key: 'CostCenter', value: '1234' }],
    })

    /**
     * Create a BucketPolicy and associate it with the bucket.
     * 
     * The association only
     * exists at the CloudFormation level -- right now we don't have (need) knowledge
     * that the BucketName -> Bucket link implies a relationship.
     */
    const pol = new BucketPolicy(bucket, 'BucketPolicy', {
      bucketName: bucket.ref,
    });

    /**
     * Add a statement to a policy. Note that we opt for a declaration of a new
     * object that links to another object, rather than a mutating statement
     * (`policy.addStatement`). The mutation still happens (or rather, the
     * linking does), but it's not part of the user-facing API.
     *
     * Should `PolicyStatement` be a construct itself? Does it need identity? Right
     * now it is not a construct, and therefore breaks consistency a bit with the rest.
     * If it were a construct we would need to come up with an id, and we could only
     * create it in the context of a construct tree.
     */
    new PolicyStatement({
      policyDocument: pol.policyDocument,
      actions: ['s3:GetObject'],
      principals: ['*'],
    });
  });
}

/**
 * 
 * ## App1 - Modifiers
 * 
 * We set properties not using properties, but using "modifiers" instead of
 * "plain old properties". Modifiers are passed in an optional additional
 * list argument.
 * 
 * Some notes:
 * 
 * - The `Bucket.Tag` operation adds a tag of the given name -- we used to define
 *   the entire `tags` array, now we are adding inidivual elements to it.
 * - For the `BucketPolicy`, instead of having the user pluck out
 *   the bucket's name to pass to the policy we provider the `BucketPolicy.Bucket` modifier
 *   that knows how to do this. The user can freely use the constructor property, the
 *   string modifier or the Bucket modifier.
 * 
 * In the API I've currently chosen, the construct parameters look like 
 * `(scope, id, props, modifiers)`, so we do see the empty dictionary
 * argument `{}` dangling around in the argument list.
 * 
 * Modifiers could have been classes `new Bucket.BucketName()`, `new Bucket.Tag()`, but
 * I've chosen to make them functions to cut down on syntactic noise.
 * 
 * It should be an error if a modification doesn't apply to anything.
 */
function app1() {
  return Root.with((root) => {
    const bucket = new Bucket(root, 'Bucket', {}, [
      Bucket.BucketName('MyBucket'),
      Bucket.Tag('CostCenter', '1234'),
    ]);

    const pol = new BucketPolicy(bucket, 'BucketPolicy', {}, [
      // This is possible:
      // BucketPolicy.BucketName(bucket.bucketName),

      // But this is preferred:
      BucketPolicy.Bucket(bucket),
    ]);

    new PolicyStatement({
      policyDocument: pol.policyDocument,
      actions: ['s3:GetObject'],
      principals: ['*'],
    });
  });
}

/**
 * 
 * ## App2 - constructs themselves can be passed as modifiers
 * 
 * Constructs themselves can be passed in the same place as modifiers; if they
 * are aware of links they can have to constructs, they can be pass as modifiers
 * to other constructs and will link up to them automatically.
 * 
 * Right now, BucketPolicy is not aware that it can link to a Bucket, so it needs
 * some help to declare a link to a Bucket and turn that into a BucketName. If it was
 * aware (either because we enhance the L1 level or we add an L2 level class with
 * that capability), we could just declare a BucketPolicy as a modifier to a Bucket
 * directly.
 * 
 */
function app2() {
  const root = new Root();

  new Bucket(root, 'Bucket', {}, [
    Bucket.BucketName('MyBucket'),
    Bucket.Tag('CostCenter', '1234'),

    // Scope.FLOATING roots the BucketPolicy under the first construct it is
    // being applied to in the construct tree.
    new BucketPolicy(Scope.FLOATING, 'BucketPolicy', {}, [
      // If BucketPolicy were aware that it could be linked to a Bucket, the
      // following modifier would be unncessary. We need a modifier which, when
      // applied to the BucketPolicy, makes that policy linkable to a Bucket. 
      BucketPolicy.AutomaticBucketName(),

      new PolicyStatement({
        actions: ['s3:GetObject'],
        principals: ['*'],
      }),
    ]),
  ]);
  return root;
}

/**
 * ### Musings on syntax and consistency
 * 
 * Since we are stating that:
 * 
 * ```ts
 * new ConstructA(scope1, id1, {}, [
 *   new ConstructB(scope2, id2, {
 *     xyz: 'xyz',
 *   }),
 * ]);
 * ```
 * 
 * is equivalent to:
 * 
 * ```ts
 * const a = new ConstructA(scope1, id1);
 * new ConstructB(scope2, id2, {
 *   constructA: a,
 *   xyz: 'xyz',
 * });
 * ```
 * 
 * I.e., passing `constructA: a` is equivalent to nesting inside the declaration of `a`,
 * this should perhaps for consistency's sake also be the case for simple modifiers:
 * 
 * ```ts
 * new Bucket(scope, id, {
 *   bucketName: 'xyz',
 * });
 * 
 * // is equivalent to
 * 
 * new Bucket(scope, id, {}, [
 *   Bucket.BucketName({
 *     bucketName: 'xyz',
 *   })
 * ]);
 * 
 * // is equivalent to
 * 
 * const bucket = new Bucket(scope, id);
 * Bucket.BucketName({
 *   bucket: bucket,
 *   bucketName: 'xyz',
 * });
 * ```
 * 
 * However, in the common case this would force:
 * 
 * ```ts
 * new Bucket(scope, id, {}, [
 *   Bucket.BucketName({
 *     bucketName: 'xyz',
 *   })
 * ]);
 * 
 * // instead of 
 * 
 * new Bucket(scope, id, {}, [
 *   Bucket.BucketName('xyz'),
 * ]);
 * ```
 * 
 * Whereas I feel that the second syntax here would be terser and therefore nicer.
 */

/**
 * 
 * ## App3 - abstraction
 * 
 * In this example, we're defining a compound resource: a Bucket with a Policy.
 * 
 * Modifications apply to all constructs in a subtree, so as long as the compound
 * resources are nested together, it will transparently apply tweaks wherever they
 * make sense. (We could also achieve the same result by combining the `Bucket`
 * and `BucketPolicy` into a parent construct, but that would change logical IDs
 * and mess with the equivalence tests at the bottom of this file.)
 */

function fancyBucket(scope: Construct, id: string, tweaks?: ILinkable[]) {
  return new Bucket(scope, id, {}, [
    Bucket.BucketName('MyBucket'),
    Bucket.Tag('CostCenter', '1234'),

    new BucketPolicy(Scope.FLOATING, 'BucketPolicy', {}, [
      BucketPolicy.AutomaticBucketName()
    ]),

    ...tweaks ?? [],
  ]);
}

/**
 * app3: use `fancyBucket` and apply a `PolicyStatement` to the compound
 * resource (in fact it will apply to the `PolicyDocument` inside the compound
 * resource).
 */
function app3() {
  return Root.with(root => 
    fancyBucket(root, 'Bucket', [
      new PolicyStatement({
        actions: ['s3:GetObject'],
        principals: ['*'],
      }),
    ]));
}

/**
 * app4: Use 'fancyBucket' but use an explicit link operation
 * 
 * Basically the same as the previous example, but use the `x.link()`
 * operation to apply the modifications. This is equivalent to passing
 * the links at construction time.
 */
function app4() {
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

/**
 * ## Validation
 * 
 * This bit of code asserts that all the examples given above are equivalent.
 */
const apps = [app0, app1, app2, app3, app4];
const rendered = apps.map((a) => [a.name, JSON.stringify(Resource.renderAll(a()), undefined, 2)]);

for (const [fn, r] of rendered) {
  if (r !== rendered[0][1]) {
    console.log(rendered[0][0], rendered[0][1]);
    console.log(fn, r);
    process.exitCode = 1;
    break;
  }
}