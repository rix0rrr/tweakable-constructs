export class Construct {
  public static isConstruct(x: any): x is Construct {
    return x instanceof Construct;
  }

  public readonly linkableTargets: string[] = [];
  public readonly creationStack: StackTrace;
  public readonly children: Record<string, Construct> = {};

  constructor(private _scope: Construct | undefined, public readonly id: string | undefined) {
    if ((id === null) !== (_scope === null)) {
        throw new Error('Id must be empty only if scope is empty');
    }
    this.creationStack = StackTrace.capture();

    if (_scope && id) {
      if (_scope.children[id]) {
        throw new Error(`Duplicate child: ${id}`);
      }
      _scope.children[id] = this;
    }
  }

  public get scope(): Construct | undefined {
    return this._scope;
  }

  protected makeLinkable(...targets: string[]) {
    this.linkableTargets.push(...targets);
  }

  /**
   * Link linkables to the current construct tree
   * 
   * `Scope.FLOATING` requires this to be a top-down operation
   */
  public link(linkables?: Array<ILinkable | undefined>) {
    for (const linkable of linkables ?? []) {
      if (!linkable) { continue; }
      if (Construct.isConstruct(linkable) && linkable.scope === Scope.FLOATING) {
        linkable.reparentTo(this);
      }

      Linkable.tryLink(linkable, this);
    }

    for (const child of Object.values(this.children)) {
      child.link(linkables);
    }

    // FIXME: it should be an error if none of the linkables found anything to link to
    // in this traversal.
  }

  public get constructPath(): string[] {
    let x: Construct = this;
    const ret: string[] = [];
    while (x.scope && x.id) {
      ret.unshift(x.id);
      x = x.scope;
    }
    return ret;
  }

  public toString() {
    return `${this.constructor.name}@${this.constructPath.join('/')}`;
  }

  private reparentTo(newParent: Construct) {
    if (!this.scope || !this.id) {
      throw new Error('Can only reparent a Construct that already had a parent');
    }
    for (const [id, child] of Object.entries(this.scope.children)) {
      if (child === this) {
        delete this.scope.children[id];
      }
    }
    if (newParent.children[this.id]) {
      throw new Error(`New parent already has a child with id ${this.id}`);
    }
    this._scope = newParent;
    newParent.children[this.id] = this;
  }
}

export class Root extends Construct {
  public static with(block: (x: Construct) => void): Root {
    const ret = new Root();
    block(ret);
    return ret;
  }

  constructor() {
    super(undefined, undefined);
  }
}

/**
 * An object that can be linked to a LinkTarget
 */
export interface ILinkable {
  readonly linkTargets: string[];
  linkTo(target: Construct): void;
}

/**
 * Helper functions for linking objects
 */
export class Linkable {
  public static tryLink(linkable: ILinkable, target: Construct) {
    let result = false;
    if (linkable.linkTargets.some(t => target.linkableTargets.includes(t))) {
      linkable.linkTo(target);
      result = true;
    }
    if (process.env.DEBUG) {
      console.log(`${linkable} (${linkable.linkTargets.join(',')}?) -> ${target} (${target.linkableTargets.join(',')}!): ${result}`);
    }
  }
}

export class StackTrace {
  public static capture() {
    const trace = (new Error().stack ?? '').split('\n').slice(2); // Error, current frame, caller frame
    return new StackTrace(trace);
  }

  constructor(public readonly trace: string[]) {}
}

export class Scope {
  public static FLOATING = new Root();
}