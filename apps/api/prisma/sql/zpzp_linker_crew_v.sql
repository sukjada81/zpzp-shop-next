-- 보조 요약 뷰: "지금 기준" 크루 수. 등급 반영 배치는 이 뷰가 아니라
-- 파라미터 cutoff 쿼리(crewCountByLinker)를 써야 마감선이 정확하다.
CREATE OR REPLACE VIEW zpzp_linker_crew_v AS
SELECT ra.linker_id, COUNT(DISTINCT ra.member_uid) AS crew_count
FROM zpzp_referral_attribution ra
WHERE ra.crew_status = 'confirmed'
GROUP BY ra.linker_id;
