$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$outDir = Join-Path $root "img\specs"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# Mapa: nombre de archivo destino -> nombre del icono en la CDN de Wowhead (WotLK)
$icons = [ordered]@{
    "caballero-de-la-muerte-sangre"   = "spell_deathknight_bloodpresence"
    "caballero-de-la-muerte-escarcha" = "spell_deathknight_frostpresence"
    "caballero-de-la-muerte-profano"  = "spell_deathknight_unholypresence"
    "druida-equilibrio"               = "spell_nature_starfall"
    "druida-feral"                    = "ability_druid_catform"
    "druida-restauracion"             = "spell_nature_healingtouch"
    "cazador-bestias"                 = "ability_hunter_beasttaming"
    "cazador-punteria"                = "ability_marksmanship"
    "cazador-supervivencia"           = "ability_hunter_swiftstrike"
    "mago-arcano"                     = "spell_holy_magicalsentry"
    "mago-fuego"                      = "spell_fire_firebolt02"
    "mago-escarcha"                   = "spell_frost_frostbolt02"
    "paladin-sagrado"                 = "spell_holy_holybolt"
    "paladin-proteccion"             = "spell_holy_devotionaura"
    "paladin-reprension"              = "spell_holy_auraoflight"
    "sacerdote-disciplina"            = "spell_holy_wordfortitude"
    "sacerdote-sagrado"               = "spell_holy_guardianspirit"
    "sacerdote-sombra"                = "spell_shadow_shadowwordpain"
    "picaro-asesinato"                = "ability_rogue_eviscerate"
    "picaro-combate"                  = "ability_backstab"
    "picaro-sutileza"                 = "ability_stealth"
    "chaman-elemental"                = "spell_nature_lightning"
    "chaman-mejora"                   = "spell_nature_lightningshield"
    "chaman-restauracion"             = "spell_nature_magicimmunity"
    "brujo-afliccion"                 = "spell_shadow_deathcoil"
    "brujo-demonologia"               = "spell_shadow_metamorphosis"
    "brujo-destruccion"               = "spell_shadow_rainoffire"
    "guerrero-armas"                  = "ability_warrior_savageblow"
    "guerrero-furia"                  = "ability_warrior_innerrage"
    "guerrero-proteccion"             = "ability_warrior_defensivestance"
}

$base = "https://wow.zamimg.com/images/wow/icons/large"
$ok = 0
$fail = 0

foreach ($entry in $icons.GetEnumerator()) {
    $url = "$base/$($entry.Value).jpg"
    $dest = Join-Path $outDir "$($entry.Key).jpg"
    try {
        Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
        Write-Host "OK   $($entry.Key).jpg"
        $ok++
    }
    catch {
        Write-Host "FALLO $($entry.Key).jpg  <- $url"
        $fail++
    }
}

Write-Host "---"
Write-Host "Descargados: $ok  Fallidos: $fail"

# Limpieza: eliminar los antiguos placeholders SVG que ya no se usan
Get-ChildItem -Path $outDir -Filter *.svg -ErrorAction SilentlyContinue | Remove-Item -Force
