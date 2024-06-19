import colorList from "./colorList";

export default function numToColorCode(num: number): string {
  for (let i = 0; i < colorList.length; i++) {
    if (colorList[i].code === num) {
      return colorList[i].color;
    }
  }
  return "black";
}
