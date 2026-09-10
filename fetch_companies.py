"""
행정안전부_식품_식품제조가공업 조회서비스 수집 스크립트
- 부산/울산/경남 지역 업체만 필터링해서 company-data.json 생성
- GitHub Actions에서 매일 실행됨 (SERVICE_KEY는 저장소 Secret으로 주입)
"""
import os
import json
import time
import urllib.request
import urllib.parse

SERVICE_KEY = os.environ["FOOD_API_SERVICE_KEY"]  # GitHub Secret에서 주입
BASE_URL = "https://apis.data.go.kr/1741000/food_manufacturing_processors/info"

# 관할 3개 지역 (도로명주소 LIKE 검색)
REGIONS = ["부산광역시", "울산광역시", "경상남도"]

# 제외할 상태 (폐업/취소/말소 등은 리스트에서 뺌)
EXCLUDE_STATUS_KEYWORDS = ["폐업", "취소", "말소"]


def call_api(region, page_no, num_of_rows=100):
    # serviceKey는 data.go.kr에서 이미 URL-인코딩된 값으로 내려오므로
    # 여기서 다시 인코딩하면 이중 인코딩이 되어 인증 실패(403)가 난다.
    # -> serviceKey만 raw로 붙이고, 나머지 파라미터만 인코딩한다.
    other_params = {
        "pageNo": str(page_no),
        "numOfRows": str(num_of_rows),
        "returnType": "JSON",
        "cond[ROAD_NM_ADDR::LIKE]": region,
    }
    query = urllib.parse.urlencode(other_params, quote_via=urllib.parse.quote)
    url = f"{BASE_URL}?serviceKey={SERVICE_KEY}&{query}"

    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"[HTTP {e.code}] 응답 본문:\n{body[:1000]}")
        raise
    return json.loads(raw)


def fetch_region(region):
    results = []
    page_no = 1
    while True:
        data = call_api(region, page_no)
        header = data.get("response", {}).get("header", {})
        if header.get("resultCode") not in ("00", "0", None):
            print(f"[경고] {region} page {page_no} 응답코드: {header}")
            break

        body = data.get("response", {}).get("body", {})
        total_count = int(body.get("totalCount", 0))
        items = body.get("items") or {}
        item_list = items.get("item") or []
        if isinstance(item_list, dict):  # 결과가 1건이면 dict로 올 수 있음
            item_list = [item_list]

        results.extend(item_list)
        print(f"{region} page {page_no}: {len(item_list)}건 (누적 {len(results)}/{total_count})")

        if len(results) >= total_count or not item_list:
            break
        page_no += 1
        time.sleep(0.3)  # API 예의상 딜레이

    return results


def is_active(item):
    status = (item.get("SALS_STTS_NM") or "") + (item.get("DTL_SALS_STTS_NM") or "")
    return not any(kw in status for kw in EXCLUDE_STATUS_KEYWORDS)


def normalize(item):
    return {
        "name": item.get("BPLC_NM"),
        "address": item.get("ROAD_NM_ADDR") or item.get("LOTNO_ADDR"),
        "status": item.get("SALS_STTS_NM"),
        "detail_status": item.get("DTL_SALS_STTS_NM"),
        "permit_date": item.get("LCPMT_YMD"),
        "closed_date": item.get("CLSBIZ_YMD"),
        "tel": item.get("TELNO"),
        "homepage": item.get("HPG"),
        "mgmt_no": item.get("MNG_NO"),
        "updated_at": item.get("DAT_UPDT_PNT"),
        # 아래는 기존 거래처 명단 확보 후 매칭해서 채울 예정
        "is_existing_customer": None,
    }


def main():
    all_items = []
    seen_mgmt_no = set()

    for region in REGIONS:
        raw_items = fetch_region(region)
        for item in raw_items:
            if not is_active(item):
                continue
            mgmt_no = item.get("MNG_NO")
            if mgmt_no in seen_mgmt_no:
                continue
            seen_mgmt_no.add(mgmt_no)
            all_items.append(normalize(item))

    all_items.sort(key=lambda x: x["name"] or "")

    output = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "count": len(all_items),
        "companies": all_items,
    }

    with open("company-data.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=1)

    print(f"완료: 총 {len(all_items)}개 업체 저장")


if __name__ == "__main__":
    main()
