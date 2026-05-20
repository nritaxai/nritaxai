export function parseSvg() {
  throw new Error(
    "@react-pdf/svg is not available from npm. This local shim only satisfies installation and build-time imports."
  );
}

export default {
  parseSvg,
};
