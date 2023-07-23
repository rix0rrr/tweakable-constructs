import { Construct, DerivedProperty, LinkRelationship, Property, Root, ScalarProperty } from "../cdkv3";

test('Derived from initial value', () => {
  const prop = new ScalarProperty();
  prop.set(3);

  const derived = new DerivedProperty(prop, (x) => x * 2);

  expect(derived.value).toEqual(6);
});

test('Derived from Link', () => {
  const root = new Root();
  const prop = new LinkRelationship([], new NumberConstruct(root, 'Nr', 2));
  const derived = new DerivedProperty(prop, (x) => x.value * 2);
  expect(derived.value).toEqual(6);
});

class NumberConstruct extends Construct {
  constructor(scope: Construct, id: string, public readonly value: number) {
    super(scope, id);
  }
}