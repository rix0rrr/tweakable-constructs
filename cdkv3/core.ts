import { Construct, StackTrace, ILinkable, Linkable } from "./construct";

//////////////////////////////////////////////////////////////////////
// RESOURCE

export class Resource extends Construct {
  public static findAll(scope: Construct) {
    const ret = new Array<Resource>();

    const stack: Array<Construct> = [scope];
    while (stack.length > 0) {
      const first = stack.shift()!;

      if (first instanceof Resource) {
        ret.push(first);
      }

      stack.push(...Object.values(first.children));
    }
    return ret;
  }

  public static renderAll(scope: Construct) {
    const res = Resource.findAll(scope);

    // Stabilize render
    res.sort((a, b) => a.constructPath.join('/').localeCompare(b.constructPath.join('/')));

    const ret = {};
    for (const r of res) {
      Object.assign(ret, r.render());
    }
    return ret;
  }

  private readonly properties: Record<string, Property> = {};
  private readonly links: LinkRelationship[] = [];

  constructor(scope: Construct, id: string, public readonly resourceType: string) {
    super(scope, id);
  }

  public get logicalId() {
    return this.constructPath.join('');
  }

  protected addProperty(name: string, prop: Property) {
    if (this.properties[name]) {
      throw new Error(`Duplicate property: ${name}`);
    }

    this.properties[name] = prop;
  }

  protected addLink(link: LinkRelationship): LinkRelationship {
    this.links.push(link);
    return link;
  }

  public property(name: string) {
    if (!this.properties[name]) {
      throw new Error(`Unknown property: ${name}`);
    }
    return this.properties[name];
  }

  public render() {
    return {
      [this.logicalId]: {
        Type: this.resourceType,
        Properties: Object.fromEntries(Object.entries(this.properties).map(([name, prop]) => [name, prop.rendered()])),
      },
    };
  }

  public get ref() {
    return { Ref: this.logicalId };
  }

  public linkTo(target: Construct): void {
    // Automatically link all Links on this Resource
    for (const link of this.links) {
      if (link.targets.some(l => target.linkableTargets.includes(l))) {
        link.set(target);
      }
    }
  }
}

//////////////////////////////////////////////////////////////////////
// PROPERTIES

export interface IObservable {
  addObserver(obs: (x: any) => void): void;
}

export abstract class Observable implements IObservable {
  private readonly observers = new Array<(x: any) => void>();

  public addObserver(obs: (x: any) => void) {
    this.observers.push(obs);
  }

  protected fire(x: any) {
    for (const obs of this.observers) {
      obs(x);
    }
  }
}

export abstract class Property extends Observable implements IObservable {
  public abstract value: any;

  public toString() {
    return `${this.constructor.name}`;
  }

  public addObserver(obs: (x: any) => void) {
    super.addObserver(obs);
    if (this.value !== undefined) {
      obs(this.value);
    }
  }

  public rendered() {
    const x = this.value;
    return isRenderable(x) ? x.render() : x;
  }
}

export class ScalarProperty extends Property {
  private _value: any | undefined;
  public changeTrace?: StackTrace;

  constructor(initialValue?: any) {
    super();
    this._value = initialValue;
  }

  public get hasValue() {
    return this._value !== undefined;
  }

  public get value() {
    return this._value;
  }

  public set(x: any) {
    this.changeTrace = StackTrace.capture();
    this._value = x;
    this.fire(this._value);
  }
}

export class CollectionProperty extends Property {
  private _value: any[] = [];

  public get value() {
    return this._value;
  }

  public add(x: any) {
    this._value.push(x);
    this.fire(this._value);
  }

  public addObserver(obs: (x: any) => void) {
    super.addObserver(obs);
    if (this.value !== undefined) {
      obs(this.value);
    }
  }
}

/**
 * An object that represents a link to a construct
 */
export class LinkRelationship extends Observable {
  private _value: Construct | undefined;
  public changeTrace?: StackTrace;

  constructor(public readonly targets: string[], initialValue?: Construct) {
    super();
    if (initialValue !== undefined) {
      this.set(initialValue);
    }
  }

  public get hasValue() {
    return this._value !== undefined;
  }

  public get value() {
    return this._value;
  }

  public set(x: Construct) {
    if (this._value !== undefined) {
      throw new Error('Link already has a value');
    }
    this._value = x;
    this.changeTrace = StackTrace.capture();
    this.fire(this._value);
  }

  public addObserver(obs: (x: Construct) => void) {
    super.addObserver(obs);
    if (this.value !== undefined) {
      obs(this.value);
    }
  }
}

export class DerivedProperty extends ScalarProperty {
  constructor(observed: IObservable, tx: (x: any) => any) {
    super();
    observed.addObserver((x) => {
      this.set(tx(x));
    });
  }
}

//////////////////////////////////////////////////////////////////////
// TWEAKS

export class ScalarTweak implements ILinkable {
  constructor(public readonly resourceType: string, public readonly property: string, public readonly value: any) {
  }

  public get linkTargets() {
    return [this.resourceType];
  }

  public linkTo(res: Construct) {
    if (!(res instanceof Resource)) {
      throw new Error(`Expected Resource to link, got ${res}`);
    }

    const prop = res.property(this.property);
    if (!(prop instanceof ScalarProperty)) {
      throw new Error(`ScalarTweak expects ScalarProperty, got ${prop}`);
    }

    if (prop.hasValue) {
      throw new Error(`${this.resourceType} ${this.property} already has a value`);
    }

    prop.set(this.value);
  }

  public toString() {
    return `${this.constructor.name}(${JSON.stringify(this.resourceType)}, ${JSON.stringify(this.property)}, ${JSON.stringify(this.value)})`;
  }
}

export class CollectionTweak implements ILinkable {
  constructor(public readonly resourceType: string, public readonly collection: string, public readonly value: any) {
  }

  public get linkTargets() {
    return [this.resourceType];
  }

  public linkTo(res: Resource) {
    if (!(res instanceof Resource)) {
      throw new Error(`Expected Resource to link, got ${res}`);
    }

    const prop = res.property(this.collection);
    if (!(prop instanceof CollectionProperty)) {
      throw new Error(`ListTweak expects ListProperty, got ${prop}`);
    }
    prop.add(this.value);
  }

  public toString() {
    return `${this.constructor.name}(${JSON.stringify(this.resourceType)}, ${JSON.stringify(this.collection)}, ${JSON.stringify(this.value)})`;
  }
}

export interface IRenderable {
  render(): any;
}

export function isRenderable(x: any): x is IRenderable {
  return x && typeof x === 'object' && (x as IRenderable).render;
}