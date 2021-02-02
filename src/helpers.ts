import { ArrayVector, dateTimeParse, Field, FieldType, getDisplayProcessor, TimeZone } from '@grafana/data';

export const measureText = (text: string, size: string): number => {
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.font = `${size} sans-serif`;
    return ctx.measureText(text).width;
  }
  return 0;
};

export const ensureTimeField = (field?: Field, timeZone?: TimeZone): Field | undefined => {
  if (field?.type === FieldType.number) {
    const tmp = { ...field, type: FieldType.time };
    tmp.display = getDisplayProcessor({ field: tmp });
    return tmp;
  } else if (field?.type === FieldType.string) {
    const tmp = {
      ...field,
      type: FieldType.time,
      values: new ArrayVector(
        field.values
          .toArray()
          .map((_: string) => dateTimeParse(_, { timeZone, format: 'YYYY-MM-DDTHH:mm:ss.SSSSSSSZ' }).valueOf())
      ),
    };
    tmp.display = getDisplayProcessor({ field: tmp });
    return tmp;
  }
  return field;
};
