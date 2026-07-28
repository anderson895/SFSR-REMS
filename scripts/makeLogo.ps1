# Trims the transparent margin off the logo artwork and writes web-sized PNGs.
#
# The source is a 1024x1536 canvas with the mark floating in the middle of a
# large empty area. Left as-is, CSS sizes the *canvas*, so the visible mark
# renders far smaller than the box it occupies and cannot be aligned against
# the wordmark next to it. Cropping to the ink fixes that at the source.
#
#   powershell -File scripts/makeLogo.ps1 <source.png> <destination.png>

param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination,
    [int]$TargetHeight = 128
)

Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Image]::FromFile((Resolve-Path $Source).Path)
$bmp = New-Object System.Drawing.Bitmap($img)
$img.Dispose()

# LockBits rather than GetPixel: 1.5M managed calls takes minutes, one memory
# copy takes milliseconds.
$rect = New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, $bmp.Height)
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bytes = New-Object byte[] ($data.Stride * $bmp.Height)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$bmp.UnlockBits($data)

# Anything above a whisper of alpha counts as ink; fully-transparent pixels
# and near-invisible antialiasing fringe do not.
$minX = $bmp.Width; $minY = $bmp.Height; $maxX = -1; $maxY = -1
for ($y = 0; $y -lt $bmp.Height; $y++) {
    $row = $y * $data.Stride
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        if ($bytes[$row + $x * 4 + 3] -gt 12) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

if ($maxX -lt 0) { throw "No visible pixels found in $Source" }

$w = $maxX - $minX + 1
$h = $maxY - $minY + 1
Write-Host ("  ink bounds : {0},{1} -> {2}x{3} (from {4}x{5})" -f $minX, $minY, $w, $h, $bmp.Width, $bmp.Height)

$scale = $TargetHeight / $h
$outW = [int][Math]::Round($w * $scale)
$outH = $TargetHeight

$out = New-Object System.Drawing.Bitmap($outW, $outH,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)
$g.DrawImage($bmp, (New-Object System.Drawing.Rectangle(0, 0, $outW, $outH)),
    $minX, $minY, $w, $h, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()

$out.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
$out.Dispose()
$bmp.Dispose()

Write-Host ("  wrote      : {0} ({1}x{2}, {3:N0} KB)" -f $Destination, $outW, $outH,
    ((Get-Item $Destination).Length / 1KB))
