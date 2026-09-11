param(
  [int]$Port = 5500
)

$root = $PSScriptRoot
$url = "http://127.0.0.1:$Port/index.html"

Write-Host "Iniciando host local em $root"

if (Get-Command node -ErrorAction SilentlyContinue) {
  Write-Host "Host local disponivel em $url"
  node "$root\serve.js" $Port
  exit $LASTEXITCODE
}

if (Get-Command py -ErrorAction SilentlyContinue) {
  Write-Host "Host local disponivel em $url"
  py -m http.server $Port --bind 127.0.0.1 --directory $root
  exit $LASTEXITCODE
}

Write-Error "Node.js ou o launcher py do Python nao foram encontrados."
exit 1