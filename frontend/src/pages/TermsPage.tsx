import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <div className="container" style={{ padding: '20px' }}>
      <div className="mb-4">
        <Link to="/">■掲示板に戻る■</Link>
      </div>
      <h2 style={{ fontSize: '20px', color: '#CC0000', margin: '15px 0' }}>利用規約</h2>
      <div style={{ backgroundColor: '#fff', padding: '15px', border: '1px solid #ccc' }}>
        <p>1. 本掲示板の利用について</p>
        <p style={{ marginLeft: '15px', marginBottom: '15px' }}>
          本掲示板はどなたでも自由にご利用いただけますが、公序良俗に反する書き込み、他者への誹謗中傷、違法な情報のやり取りは禁止します。
        </p>

        <p>2. プライバシーについて</p>
        <p style={{ marginLeft: '15px', marginBottom: '15px' }}>
          書き込み時のIPアドレスはハッシュ化され、一定の匿名性が保たれますが、法的機関からの正当な要請があった場合は情報の開示を行う場合があります。
        </p>

        <p>3. データの取り扱い</p>
        <p style={{ marginLeft: '15px', marginBottom: '15px' }}>
          投稿されたデータは管理人の判断により、予告なく削除される場合があります。また、システムトラブルによるデータ消失について管理人は一切の責任を負いません。
        </p>

        <p>4. 規約の変更</p>
        <p style={{ marginLeft: '15px', marginBottom: '15px' }}>
          本規約は予告なく変更される場合があります。変更後は即時有効となります。
        </p>
      </div>
    </div>
  );
}
