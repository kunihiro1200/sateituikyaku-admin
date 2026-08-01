$headers = @{
    "Authorization" = "Bearer a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s="
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-WebRequest -Uri "https://sateituikyaku-admin-backend.vercel.app/api/sync/trigger?buyerAddition=true&additionOnly=true" -Method POST -Headers $headers -TimeoutSec 30 -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Body: $($response.Content)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
        Write-Host "Status: $statusCode"
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Body: $($reader.ReadToEnd())"
    }
}
