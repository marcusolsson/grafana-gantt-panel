export const measureText = (text: string): number => {
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.font = '10px sans-serif';
    return ctx.measureText(text).width;
  }
  return 0;
};
