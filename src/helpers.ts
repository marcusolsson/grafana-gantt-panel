export const measureText = (text: string, size: string): number => {
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.font = `${size} sans-serif`;
    return ctx.measureText(text).width;
  }
  return 0;
};
