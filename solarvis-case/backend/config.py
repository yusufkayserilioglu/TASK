import math

# Case koordinatı (enlem negatif — gerekçe: DECISIONS.md / README)
FIXED_LAT = -34.04658242871865
FIXED_LON = 18.46491476666948
ZOOM = 20
SCALE = 2
SIZE = 640
IMG_PX = SIZE * SCALE


def meters_per_pixel(lat: float, zoom: int, scale: int) -> float:
    """Web Mercator: 156543.03392 = 2*pi*6378137 / 256 (zoom-0, ekvator)."""
    return 156543.03392 * math.cos(math.radians(lat)) / (2 ** zoom) / scale