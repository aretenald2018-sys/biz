'use client';

import { Navigate, Route, Routes } from 'react-router-dom';
import TermsAssetsPage from '@/app/terms/assets/page';
import TermsCandidatesPage from '@/app/terms/candidates/page';
import TermsDocumentsPage from '@/app/terms/documents/[assetId]/page';
import TermsReviewPage from '@/app/terms/review/page';
import { TermsHubView } from '@/components/terms/hub-view';

export default function TermsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border bg-white px-7 py-7 shadow-sm">
        <div className="text-xs tracking-[0.24em] text-primary">COMPLIANCE</div>
        <div className="mt-3">
          <h1 className="text-[28px] font-medium text-foreground">약관 컴플라이언스</h1>
          <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
            법인을 선택하고 [자동 정리]를 누르면, 해당 법인의 약관을 수집·분석해서 수집 데이터·목적·이전 목적·한국 이전을
            자동으로 채워줍니다.
          </p>
        </div>
      </section>

      <Routes>
        <Route index element={<TermsHubView />} />

        {/* 숨김 라우트 — URL 로 직접 접근 시에만 노출 */}
        <Route path="review" element={<TermsReviewPage />} />
        <Route path="documents/:assetId" element={<TermsDocumentsPage />} />
        <Route path="admin" element={<Navigate to="/terms/admin/assets" replace />} />
        <Route path="admin/assets" element={<TermsAssetsPage />} />
        <Route path="admin/candidates" element={<TermsCandidatesPage />} />

        {/* 구 경로 호환 */}
        <Route path="board" element={<Navigate to="/terms" replace />} />
        <Route path="assets" element={<Navigate to="/terms/admin/assets" replace />} />
        <Route path="candidates" element={<Navigate to="/terms/admin/candidates" replace />} />
        <Route path="inbox" element={<Navigate to="/terms" replace />} />
      </Routes>
    </div>
  );
}
