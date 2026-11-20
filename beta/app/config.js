/* 工時記錄：雲端同步設定（正式專案 timesheet，ref uqfhqyhhafrnfwdvugcv）。
 * publishable key（sb_publishable_…）本來就是公開給瀏覽器用的；真正的保護是資料表上的 RLS。
 * 絕對不要把 secret / service_role key 放進這裡（程式偵測到 sb_secret_ 會拒絕啟用）。
 * 把 supabaseUrl 改回佔位符 = 純本機模式。 */
window.WORKLOG_CONFIG = {
  supabaseUrl: 'https://uqfhqyhhafrnfwdvugcv.supabase.co',
  supabaseAnonKey: 'sb_publishable_jcG4bhofi0lP_jin5k5_0w_6AlqAYhQ',
  // 顯示在登入畫面的 OAuth 提供者（需先在 Supabase → Authentication → Providers 啟用）。
  // 日後要加 Apple：加上 'apple'，並完成 SETUP.md 附錄的 Apple 設定。
  providers: ['google'],
  // Email 登入目前關閉：專案沒有自訂 SMTP，信件範本不能改。開啟步驟見 SETUP.md〈日後開啟 Email 登入〉。
  emailOtp: false,
};

// beta build (/timesheet/beta/): own localStorage keys, never the production worklog.v1
window.WORKLOG_CONFIG = Object.assign({}, window.WORKLOG_CONFIG, { storageNamespace: 'worklog.beta' });
