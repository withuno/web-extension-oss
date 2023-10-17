export namespace Colors {
  export interface RGB {
    red: number;
    green: number;
    blue: number;
  }

  export interface RGBA extends RGB {
    alpha: number;
  }
}

export function getLightness({ red, green, blue }: Colors.RGB) {
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255; // per ITU-R BT.709
}

export function createColorFromCSS(cssValue: string): Colors.RGBA {
  let rgba: Colors.RGBA = {
    red: 0,
    green: 0,
    blue: 0,
    alpha: 0,
  };

  if (!cssValue.startsWith("rgb")) {
    return rgba;
  }

  const parsedColor = cssValue
    .split("(")[1]
    .split(")")[0]
    .split(",")
    .map((v) => v.trim());

  return (
    parsedColor &&
      parsedColor.length >= 3 &&
      (rgba = {
        red: Number(parsedColor[0]),
        green: Number(parsedColor[1]),
        blue: Number(parsedColor[2]),
        alpha: parsedColor.length === 4 ? Number(parsedColor[3]) : 1,
      }),
    rgba
  );
}
