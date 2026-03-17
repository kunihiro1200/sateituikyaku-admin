#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AreaMapConfigService.ts の loadAreaMaps() を修正:
DBの coordinates カラムを優先使用し、ない場合のみURLから抽出する
"""

with open('backend/src/services/AreaMapConfigService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 置換対象: "// Extract coordinates if URL exists" から "}" まで
old_block = '''        // Extract coordinates if URL exists
        if (config.googleMapUrl) {
          if (!this.isValidGoogleMapsUrl(config.googleMapUrl)) {
            this.logError('Skipping area due to invalid Google Maps URL', {
              areaNumber: config.areaNumber,
              url: config.googleMapUrl
            });
            skippedConfigs.push(config.areaNumber);
            continue;
          }

          try {
            const coords = await this.geolocationService.extractCoordinatesFromUrl(config.googleMapUrl);
            if (coords) {
              config.coordinates = coords;
              this.logInfo(`Extracted coordinates for area ${config.areaNumber}`, {
                lat: coords.lat,
                lng: coords.lng
              });
            } else {
              this.logWarning('Failed to extract coordinates', {
                areaNumber: config.areaNumber,
                url: config.googleMapUrl,
                action: 'Skipping this area'
              });
              skippedConfigs.push(config.areaNumber);
              continue;
            }
          } catch (coordError) {
            this.logError('Exception while extracting coordinates', {
              areaNumber: config.areaNumber,
              url: config.googleMapUrl,
              error: coordError instanceof Error ? coordError.message : String(coordError)
            });
            skippedConfigs.push(config.areaNumber);
            continue;
          }
        }'''

if old_block in text:
    print('✅ 対象コードが見つかりました')
else:
    print('❌ 対象コードが見つかりません（改行コードの違いを確認）')
    # CRLF -> LF に変換して再試行
    text_lf = text.replace('\r\n', '\n')
    old_block_lf = old_block.replace('\r\n', '\n')
    if old_block_lf in text_lf:
        print('  CRLF->LF変換後に見つかりました')
        text = text_lf
    else:
        print('  それでも見つかりません')
        # 部分一致で確認
        idx = text.find('// Extract coordinates if URL exists')
        print(f'  コメント行の位置: {idx}')
        if idx >= 0:
            print(repr(text[idx:idx+200]))

new_block = '''        // DBに座標が保存されている場合はそれを優先使用（URLからの抽出をスキップ）
        if (row.coordinates) {
          try {
            const dbCoords = typeof row.coordinates === 'string'
              ? JSON.parse(row.coordinates)
              : row.coordinates;
            if (dbCoords && typeof dbCoords.lat === 'number' && typeof dbCoords.lng === 'number') {
              config.coordinates = { lat: dbCoords.lat, lng: dbCoords.lng };
              this.logInfo(`Using cached coordinates from DB for area ${config.areaNumber}`, {
                lat: dbCoords.lat,
                lng: dbCoords.lng
              });
            }
          } catch (parseError) {
            this.logWarning('Failed to parse coordinates from DB, will try URL extraction', {
              areaNumber: config.areaNumber,
              rawCoordinates: row.coordinates
            });
          }
        }

        // DBに座標がない場合のみ、URLから抽出を試みる
        if (!config.coordinates && config.googleMapUrl) {
          if (!this.isValidGoogleMapsUrl(config.googleMapUrl)) {
            this.logError('Skipping area due to invalid Google Maps URL', {
              areaNumber: config.areaNumber,
              url: config.googleMapUrl
            });
            skippedConfigs.push(config.areaNumber);
            continue;
          }

          try {
            const coords = await this.geolocationService.extractCoordinatesFromUrl(config.googleMapUrl);
            if (coords) {
              config.coordinates = coords;
              this.logInfo(`Extracted coordinates from URL for area ${config.areaNumber}`, {
                lat: coords.lat,
                lng: coords.lng
              });
              // 次回以降のためにDBに座標を保存
              try {
                await this.supabase
                  .from('area_map_config')
                  .update({ coordinates: { lat: coords.lat, lng: coords.lng } })
                  .eq('id', row.id);
                this.logInfo(`Saved coordinates to DB for area ${config.areaNumber}`);
              } catch (saveError) {
                this.logWarning('Failed to save coordinates to DB (non-critical)', {
                  areaNumber: config.areaNumber,
                  error: saveError instanceof Error ? saveError.message : String(saveError)
                });
              }
            } else {
              this.logWarning('Failed to extract coordinates', {
                areaNumber: config.areaNumber,
                url: config.googleMapUrl,
                action: 'Skipping this area'
              });
              skippedConfigs.push(config.areaNumber);
              continue;
            }
          } catch (coordError) {
            this.logError('Exception while extracting coordinates', {
              areaNumber: config.areaNumber,
              url: config.googleMapUrl,
              error: coordError instanceof Error ? coordError.message : String(coordError)
            });
            skippedConfigs.push(config.areaNumber);
            continue;
          }
        }'''

# CRLF対応
text_normalized = text.replace('\r\n', '\n')
old_block_normalized = old_block.replace('\r\n', '\n')

if old_block_normalized in text_normalized:
    text_normalized = text_normalized.replace(old_block_normalized, new_block)
    print('✅ 置換成功')
    with open('backend/src/services/AreaMapConfigService.ts', 'wb') as f:
        f.write(text_normalized.encode('utf-8'))
    print('✅ ファイルを保存しました（UTF-8）')
else:
    print('❌ 置換失敗')
