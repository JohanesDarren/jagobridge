import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../../components/ui/Button";

export function UsageNoticePage() {
  const { acknowledgeUsageNotice } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const acknowledge = async () => {
    setSubmitting(true);
    try {
      await acknowledgeUsageNotice();
      navigate("/", { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="jb-card w-full max-w-2xl p-8 rounded-2xl shadow-xl border border-slate-200/80">
        <div className="flex items-center gap-3.5 mb-5 pb-5 border-b border-border">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0b22db] to-[#040e5e] text-white shadow-md shadow-primary/20">
            <span className="text-xl">🛡️</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Ketentuan &amp; Tata Kelola Data JagoBridge</h1>
            <p className="text-xs text-slate-500">Privasi, pencatatan metadata, dan transparansi alur kerja.</p>
          </div>
        </div>

        <div className="space-y-3.5 text-sm leading-relaxed text-slate-700">
          <p>
            JagoBridge mencatat <strong>metadata penggunaan</strong> untuk setiap permintaan: model yang digunakan, jumlah token,
            sumber (API atau playground), status respon, dan timestamp. Metadata disimpan selama 180 hari untuk kebutuhan audit dan performa.
          </p>
          <p>
            Prompt dan output respons dari traffic API <strong>tidak disimpan secara permanen</strong>. Riwayat percakapan playground
            disimpan agar Anda dapat melanjutkan sesi kerja dan dapat Anda hapus sewaktu-waktu.
          </p>
          <p>
            Seluruh prompt diteruskan ke upstream model provider untuk menghasilkan respons. Kuota penggunaan dihitung berdasarkan token terbobot
            dan diperbarui secara berkala sesuai kebijakan paket.
          </p>
          <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">
            Aktivitas administratif dan riwayat autentikasi dicatat dalam Audit Log untuk memastikan tata kelola yang aman dan terstruktur.
          </p>
        </div>
        <div className="mt-8 flex justify-end">
          <Button onClick={acknowledge} loading={submitting} size="lg" className="px-6">
            Saya Mengerti &amp; Lanjutkan →
          </Button>
        </div>
      </div>
    </div>
  );
}
