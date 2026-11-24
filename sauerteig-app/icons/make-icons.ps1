# Zeichnet die PNG-Icons der Sauerteig-App (gleiches Motiv wie icon.svg).
# Aufruf im Ordner sauerteig-app\icons:  powershell -ExecutionPolicy Bypass -File .\make-icons.ps1
Add-Type -AssemblyName System.Drawing
$dir = $PSScriptRoot

function New-LoafPath([float]$s) {
  # Koordinaten aus icon.svg (512er Raster), skaliert auf $s
  $k = $s / 512
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddBezier(120*$k,318*$k, 120*$k,214*$k, 186*$k,156*$k, 256*$k,156*$k)
  $p.AddBezier(256*$k,156*$k, 326*$k,156*$k, 392*$k,214*$k, 392*$k,318*$k)
  $p.AddBezier(392*$k,318*$k, 392*$k,343*$k, 379*$k,356*$k, 354*$k,356*$k)
  $p.AddLine(354*$k,356*$k, 158*$k,356*$k)
  $p.AddBezier(158*$k,356*$k, 133*$k,356*$k, 120*$k,343*$k, 120*$k,318*$k)
  $p.CloseFigure()
  return $p
}

function Save-Icon([int]$size, [string]$name, [bool]$rounded) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = "AntiAlias"
  $k = $size / 512
  $bg = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#55652a"))
  if ($rounded) {
    $r = 112 * $k * 2
    $rp = New-Object System.Drawing.Drawing2D.GraphicsPath
    $rp.AddArc(0, 0, $r, $r, 180, 90); $rp.AddArc($size - $r, 0, $r, $r, 270, 90)
    $rp.AddArc($size - $r, $size - $r, $r, $r, 0, 90); $rp.AddArc(0, $size - $r, $r, $r, 90, 90)
    $rp.CloseFigure(); $g.FillPath($bg, $rp)
  } else { $g.FillRectangle($bg, 0, 0, $size, $size) }
  $loaf = New-LoafPath $size
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#efe4cc"))), $loaf)
  $g.SetClip($loaf)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#d9c49a"))), 0, 330*$k, $size, 40*$k)
  $g.ResetClip()
  $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml("#55652a")), (16*$k)
  $pen.StartCap = "Round"; $pen.EndCap = "Round"
  $g.DrawLine($pen, 194*$k, 268*$k, 230*$k, 222*$k)
  $g.DrawLine($pen, 244*$k, 290*$k, 292*$k, 228*$k)
  $g.DrawLine($pen, 302*$k, 300*$k, 330*$k, 262*$k)
  $bmp.Save((Join-Path $dir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

# Kleines Symbol für die Statusleiste: weißer Laib auf transparentem Grund
function Save-Badge([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = "AntiAlias"
  $g.Clear([System.Drawing.Color]::Transparent)
  $m = New-Object System.Drawing.Drawing2D.Matrix
  $m.Translate(-0.14 * $size, -0.05 * $size); $m.Scale(1.28, 1.28)
  $loaf = New-LoafPath $size; $loaf.Transform($m)
  $g.FillPath([System.Drawing.Brushes]::White, $loaf)
  $bmp.Save((Join-Path $dir "badge.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

Save-Icon 192 "icon-192.png" $true
Save-Icon 512 "icon-512.png" $false
Save-Icon 180 "apple-touch-icon.png" $false
Save-Badge 96
Write-Host "Icons erstellt."
