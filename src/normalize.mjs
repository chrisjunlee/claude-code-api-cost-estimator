const SUFFIX_RE = /-\d{8}$/;

export function normalizeModel(model) {
  return model.replace(SUFFIX_RE, "");
}
