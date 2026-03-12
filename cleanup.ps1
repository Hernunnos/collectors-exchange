$projectRoot = $PSScriptRoot

Write-Host ""
Write-Host "CX - Project Cleanup"
Write-Host "--------------------------------------"
Write-Host "Root: $projectRoot"
Write-Host ""

$filesToDelete = @(
    "cards_catalogue.sql",
    "supabase.exe",
    "project-tree.txt",
    "src\App.css"
)

$foldersToDelete = @(
    "sql_chunks",
    "src\assets"
)

foreach ($file in $filesToDelete) {
    $path = Join-Path $projectRoot $file
    if (Test-Path $path) {
        Remove-Item $path -Force
        Write-Host "  Deleted: $file"
    } else {
        Write-Host "  Not found: $file"
    }
}

foreach ($folder in $foldersToDelete) {
    $path = Join-Path $projectRoot $folder
    if (Test-Path $path) {
        Remove-Item $path -Recurse -Force
        Write-Host "  Deleted: $folder"
    } else {
        Write-Host "  Not found: $folder"
    }
}

Get-ChildItem -Path $projectRoot -Filter "pokemon-tcg-data_cards_en*" | Remove-Item -Force
Write-Host "  Deleted: pokemon-tcg-data HTML file"

Write-Host ""
Write-Host "Done!"
Read-Host "Press Enter to close"
