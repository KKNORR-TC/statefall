$ErrorActionPreference = 'Stop'
$dockerBin = 'C:\Program Files\Docker\Docker\resources\bin'
if (Test-Path -LiteralPath $dockerBin) { $env:Path = "$dockerBin;$env:Path" }

$settings = @{}
foreach ($line in [IO.File]::ReadAllLines("$PSScriptRoot\.env")) {
    if ($line -match '^\s*([^#][^=]*)=(.*)$') { $settings[$Matches[1].Trim()] = $Matches[2].Trim().Trim('"') }
}
$base = "http://localhost:$($settings.STATEFALL_PORT)"
$compose = @('compose', '--env-file', "$PSScriptRoot\.env", '-f', "$PSScriptRoot\compose.yaml")

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-WebRequest -Uri "$base/wp-login.php" -WebSession $session -UseBasicParsing -TimeoutSec 60 | Out-Null
$login = @{log=$settings.WORDPRESS_LOCAL_ADMIN_USER;pwd=$settings.WORDPRESS_LOCAL_ADMIN_PASSWORD;'wp-submit'='Log In';redirect_to="$base/play/";testcookie='1'}
$page = Invoke-WebRequest -Uri "$base/wp-login.php" -Method Post -Body $login -WebSession $session -UseBasicParsing -TimeoutSec 60
if ($page.Content -notmatch '"nonce":"([^"]+)"') { throw 'Authenticated game page did not expose a REST nonce.' }
$headers = @{'X-WP-Nonce'=$Matches[1]}
$me = Invoke-RestMethod -Uri "$base/wp-json/statefall/v1/me" -Headers $headers -WebSession $session -TimeoutSec 60

function New-SaveBody($kind,$slot,$seed,$settingsBody=@{}) {
    return @{kind=$kind;slot=$slot;data=@{v=1;game='1.10.7';seed=$seed;settings=$settingsBody;cmds=@();hashes=@();tick=10;result='in progress'}}
}
function Post-Json($path,$body) {
    return Invoke-RestMethod -Uri "$base/wp-json/statefall/v1/$path" -Method Post -Headers $headers -WebSession $session -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 12 -Compress) -TimeoutSec 60
}
function Assert-Rejected($path,$body,$label) {
    try {
        $accepted=Post-Json $path $body
        if($accepted.id){ Invoke-RestMethod -Uri "$base/wp-json/statefall/v1/saves/$($accepted.id)" -Method Delete -Headers $headers -WebSession $session -TimeoutSec 60 | Out-Null }
        throw "$label was accepted"
    } catch [System.Net.WebException] {
        $status=[int]$_.Exception.Response.StatusCode
        if($status -notin @(400,409,422)){ throw "$label returned unexpected HTTP $status" }
    }
}

$badName='<img src=x onerror=alert(1)>'
$badReplay=New-SaveBody 'replay' 'Malicious replay' 'BADREPLAY' @{map='random';diff='normal';customBots=@(@{userId=$me.id;name=$badName;layers=(,@('h','#ffffff'));slot=0})}
Assert-Rejected 'saves' $badReplay 'unsafe replay identity'
$legacyTest='$d=["settings"=>["customBots"=>[["name"=>"<img src=x onerror=alert(1)>","layers"=>[["h","#ffffff"]],"slot"=>0]]]]; $out=wp_json_encode(statefall_public_replay_data($d)); if(strpos($out,"<")!==false||strpos($out,">")!==false){throw new Exception("unsafe legacy replay output");}'
$encoded=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($legacyTest))
$cli=$compose+@('--profile','tools','run','--rm','cli')
docker @cli eval "eval(base64_decode('$encoded'));" | Out-Null
if($LASTEXITCODE -ne 0){ throw 'legacy public replay sanitizer failed' }
$safePunctuation=Post-Json 'saves' (New-SaveBody 'save' 'Display punctuation' 'PUNCTUATION' @{map='random';diff='normal';customFlag=@{userId=$me.id;name='R&D "Ace"_1@example.test';layers=(,@('h','#ffffff'))}})
Invoke-RestMethod -Uri "$base/wp-json/statefall/v1/saves/$($safePunctuation.id)" -Method Delete -Headers $headers -WebSession $session -TimeoutSec 60 | Out-Null

$save=Post-Json 'saves' (New-SaveBody 'save' 'Immutable kind' 'KINDTEST' @{map='random';diff='normal'})
try {
    $change=New-SaveBody 'replay' 'Immutable kind' 'KINDTEST' @{map='random';diff='normal'}
    $change.id=$save.id
    Assert-Rejected 'saves' $change 'save kind mutation'
} finally {
    Invoke-RestMethod -Uri "$base/wp-json/statefall/v1/saves/$($save.id)" -Method Delete -Headers $headers -WebSession $session -TimeoutSec 60 | Out-Null
}

$auto1=Post-Json 'saves' (New-SaveBody 'save' 'Autosave' 'AUTOSAVE1' @{map='random';diff='normal'})
$auto2=$null
try {
    $auto2=Post-Json 'saves' (New-SaveBody 'save' 'Autosave' 'AUTOSAVE2' @{map='random';diff='normal'})
    if([int]$auto2.id -ne [int]$auto1.id){ throw 'reserved Autosave slot created duplicate records' }
    $manual=New-SaveBody 'save' 'Manual save' 'AUTOSAVE2' @{map='random';diff='normal'}; $manual.id=$auto1.id
    Assert-Rejected 'saves' $manual 'ID-based Autosave rename-away bypass'
    Assert-Rejected "saves/$($auto1.id)" @{slot='Manual save'} 'rename Autosave rename-away bypass'
    $ordinary=Post-Json 'saves' (New-SaveBody 'save' 'Ordinary save' 'AUTOSAVE3' @{map='random';diff='normal'})
    try {
        $reserved=New-SaveBody 'save' 'Autosave' 'AUTOSAVE3' @{map='random';diff='normal'}; $reserved.id=$ordinary.id
        Assert-Rejected 'saves' $reserved 'ID-based Autosave reservation bypass'
        Assert-Rejected "saves/$($ordinary.id)" @{slot='Autosave'} 'rename Autosave reservation bypass'
    } finally { Invoke-RestMethod -Uri "$base/wp-json/statefall/v1/saves/$($ordinary.id)" -Method Delete -Headers $headers -WebSession $session -TimeoutSec 60 | Out-Null }
} finally {
    Invoke-RestMethod -Uri "$base/wp-json/statefall/v1/saves/$($auto1.id)" -Method Delete -Headers $headers -WebSession $session -TimeoutSec 60 | Out-Null
    if($auto2 -and [int]$auto2.id -ne [int]$auto1.id){ Invoke-RestMethod -Uri "$base/wp-json/statefall/v1/saves/$($auto2.id)" -Method Delete -Headers $headers -WebSession $session -TimeoutSec 60 | Out-Null }
}

$cookie=$session.Cookies.GetCookieHeader([Uri]$base)
$nonce=$headers['X-WP-Nonce']
$jobs=@()
for($i=0;$i -lt 14;$i++){
    $body=New-SaveBody 'save' "Quota race $i" "QUOTA$i" @{map='random';diff='normal'} | ConvertTo-Json -Depth 12 -Compress
    $jobs+=Start-Job -ScriptBlock {
        param($url,$json,$cookieHeader,$restNonce)
        Add-Type -AssemblyName System.Net.Http
        $handler=[Net.Http.HttpClientHandler]::new(); $handler.UseCookies=$false
        $client=[Net.Http.HttpClient]::new($handler)
        try {
            $request=[Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Post,$url)
            $request.Headers.TryAddWithoutValidation('Cookie',$cookieHeader) | Out-Null
            $request.Headers.TryAddWithoutValidation('X-WP-Nonce',$restNonce) | Out-Null
            $request.Content=[Net.Http.StringContent]::new($json,[Text.Encoding]::UTF8,'application/json')
            $response=$client.SendAsync($request).Result
            if(-not $response.IsSuccessStatusCode){ throw "parallel save request returned HTTP $([int]$response.StatusCode)" }
        } finally { $client.Dispose() }
    } -ArgumentList "$base/wp-json/statefall/v1/saves",$body,$cookie,$nonce
}
try {
    $jobs | Wait-Job | Out-Null
    $jobs | Receive-Job -ErrorAction Stop | Out-Null
    $list=Invoke-RestMethod -Uri "$base/wp-json/statefall/v1/saves" -Headers $headers -WebSession $session -TimeoutSec 60
    $saveCount=@($list.saves | Where-Object {$_.kind -eq 'save'}).Count
    if($saveCount -gt 10){ throw "parallel save requests exceeded the hard quota: $saveCount" }
} finally {
    $jobs | Remove-Job -Force -ErrorAction SilentlyContinue
    $list=Invoke-RestMethod -Uri "$base/wp-json/statefall/v1/saves" -Headers $headers -WebSession $session -TimeoutSec 60
    foreach($item in @($list.saves | Where-Object {$_.slot -like 'Quota race *'})){ Invoke-RestMethod -Uri "$base/wp-json/statefall/v1/saves/$($item.id)" -Method Delete -Headers $headers -WebSession $session -TimeoutSec 60 | Out-Null }
}

if ($page.Content -notmatch "STATEFALL_SIGN_KEY='([^']+)'") { throw 'Game signing key was not found.' }
$key=$Matches[1]
$seed='LOCALBOT'+([DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString().Substring(4))
$record=[ordered]@{when=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();result='Defeat';country='Local test';map='random';diff='normal';fog=$false;risky=$false;cls='Standard';land=1;minutes=2;kills=0;peak=120;gold=0;seed=$seed}
$canonical=$record | ConvertTo-Json -Compress
$hmac=[Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($key))
$record.sig=-join ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($canonical)) | ForEach-Object { $_.ToString('x2') })
$record.botNations=@(@{userId=$me.id;name='Forged bot';alive=$true;land=100;killedBy='Nobody';kills=99;killedPlayer=$true;peak=999999})
$scoreId=$null
$db=@('exec','-T','db','mariadb',"-u$($settings.WORDPRESS_DB_USER)","-p$($settings.WORDPRESS_DB_PASSWORD)",$settings.WORDPRESS_DB_NAME,'-e')
docker @compose @db 'ALTER TABLE wp_statefall_saves ENGINE=MyISAM;' | Out-Null
$migration='$result=statefall_saves_create_table();'
$encoded=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($migration))
docker @cli eval "eval(base64_decode('$encoded'));" | Out-Null
if($LASTEXITCODE -ne 0){ throw 'save table engine migration failed to run' }
$engine=(docker @compose @db "SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA='$($settings.WORDPRESS_DB_NAME)' AND TABLE_NAME='wp_statefall_saves';" --skip-column-names).Trim()
if($engine -ne 'InnoDB'){ throw "save table must use InnoDB, found $engine" }
try {
    docker @compose @db "DELETE FROM wp_usermeta WHERE user_id=$($me.id) AND meta_key='statefall_botrec';" | Out-Null
    $score=Post-Json 'scores' $record
    $scoreId=[int]$score.id
    $nation=Invoke-RestMethod -Uri "$base/wp-json/statefall/v1/nation/$($me.id)" -TimeoutSec 60
    if([int]$nation.bot.matches -ne 0){ throw 'client botNations mutated account metadata' }
} finally {
    if($scoreId){ docker @compose @db "DELETE FROM wp_statefall_scores WHERE id=$scoreId;" | Out-Null }
    docker @compose @db "DELETE FROM wp_usermeta WHERE user_id=$($me.id) AND meta_key='statefall_botrec';" | Out-Null
}

Write-Host 'PASS replay XSS, immutable kind, Autosave uniqueness, and bot-record isolation regressions'
