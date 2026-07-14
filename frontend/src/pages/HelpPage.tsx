

export default function HelpPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h2 className="text-2xl font-bold border-b border-border pb-2">使い方・ヘルプ</h2>
      
      <section className="space-y-4">
        <h3 className="text-xl font-bold">1. 基本的な書き込み</h3>
        <p>
          スレッド内の一番下にあるフォームから書き込みができます。名前は省略すると「名無し」になります。
        </p>
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-bold">2. アンカー（返信・メンション）</h3>
        <p>
          他の人の書き込みに対して返信したい場合、本文中に <code>&gt;&gt;番号</code>（半角）と入力すると、自動でリンクになり、相手に通知が送られます。
        </p>
        <div className="p-4 bg-muted rounded-md text-sm">
          例: <br/>
          &gt;&gt;1 <br/>
          こんにちは！
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-bold">3. トリップ機能（本人証明）</h3>
        <p>
          名前欄に <code>#パスワード</code> を付けて書き込むと、パスワードを暗号化した文字列（トリップ）が表示されます。同じパスワードを使えば常に同じ文字列になるため、匿名でも本人であることを証明できます。
        </p>
        <div className="p-4 bg-muted rounded-md text-sm">
          例: 名無し#secret <br/>
          → 表示名: 名無し ◆XXXXXXX
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-bold">4. sage（スレッドを上げない）</h3>
        <p>
          メール欄に <code>sage</code> と入力して書き込むと、スレッドの勢い（順位）を上げずに書き込むことができます。雑談など、目立たせたくない場合に使います。
        </p>
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-bold">5. 画像・動画の投稿</h3>
        <p>
          ファイル選択ボタンから、画像や動画を添付することができます。
        </p>
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-bold">6. 通知機能</h3>
        <p>
          スレッド内の「通知を受け取る」ボタンを押すと、そのスレッドで自分宛て（&gt;&gt;付き）の返信があった際に、ブラウザにプッシュ通知が届きます。
        </p>
      </section>

    </div>
  );
}
