/**
 * Lens Builder
 * 
 * These lenses currently only support objects and lists of objects
 * (not lists of scalars).
 */
export class Lens {
  private readonly operations = new Array<ILensOp>();

  public set(key: any, value: any): Lens {
    this.operations.push({
      apply(ctx) {
        ctx.value[key] = value;
        return ctx;
      },
    });
    return this;
  }

  public descend(key: string): Lens {
    this.operations.push({
      apply(ctx) {
        if (!ctx.value || typeof ctx.value !== 'object') {
          throw new Error(`Expected object in descend() lens, got ${ctx.value}`);
        }
        ctx.value[key] = {};
        return { value: ctx.value[key], key };
      },
    });

    return this;
  }

  public addElement(): Lens {
    return this;
  }

  public apply(value: any) {
    let ctx = { value };
    for (const op of this.operations) {
      ctx = op.apply(ctx);
    }
  }
}

interface ApplyContext {
  value: any;
  key?: string;
}

interface ILensOp {
  apply(context: ApplyContext): ApplyContext;
}