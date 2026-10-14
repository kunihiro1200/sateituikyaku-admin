import re
import json

address = "福岡県福岡市南区玉川3-25サングレート高宮アヴァンセ902"

# wardMatch
ward_match = re.search(r"([東南西北博多中央城南早良]+区)", address)
ward = ward_match.group(1) if ward_match else None
print("ward:", ward)

if ward:
    parts = address.split(ward)
    after_ward = parts[1] if len(parts) > 1 else ""
    print("afterWard:", after_ward)
    
    town_match = re.match(r"^([^\d\-ー－\s\u3000]+)", after_ward)
    town = town_match.group(1).rstrip("の \u3000").strip() if town_match else None
    print("town:", town)
    
    candidates = [town] if town else []
    if town and not town.endswith("町"):
        candidates.append(town + "町")
    print("townCandidates:", candidates)

    with open("C:/Users/kunih/sateituikyaku-admin/backend/src/data/fukuoka-school-address-map.json", encoding="utf-8") as f:
        data = json.load(f)

    for tc in candidates:
        matches = [r for r in data["records"] if r["ward"] == ward and r["town"] == tc]
        print("town=%s: %d件" % (tc, len(matches)))
        for m in matches[:3]:
            print("  %s / %s range=%s" % (m["elementary"], m["juniorHigh"], m["range"]))
