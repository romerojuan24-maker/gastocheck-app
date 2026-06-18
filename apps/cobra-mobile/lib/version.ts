export const APP_VERSION = "1.0.0"
export const OTA_VERSION = 1
export const APP_NAME = "CobraCheck"
export const BUILD_DATE = "2026-06-18"

export const VERSION_STRING = `v${APP_VERSION} OTA ${OTA_VERSION}`

export const getVersionDisplay = () => {
  return `${APP_NAME} ${VERSION_STRING}`
}
