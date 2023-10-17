// --- CSS --- //

declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module "*.modules.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module "*.css";

// --- Static file types --- //

declare module "*.png";
declare module "*.svg";
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.gif";
declare module "*.webp";
declare module "*.avif";
declare module "*.ico";
declare module "*.bmp";
