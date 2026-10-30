export type LanguageChoice = 'auto' | 'ru' | 'en';
export function resolveLanguage(choice: LanguageChoice, region = navigator.language): 'ru' | 'en' {
  return choice === 'auto' ? (region.toLowerCase() === 'ru-ru' ? 'ru' : 'en') : choice;
}
let language: 'ru' | 'en' = 'ru';
export function setLanguage(choice: LanguageChoice) {
  language = resolveLanguage(choice);
  document.documentElement.lang = language;
}
// Longer phrases precede fragments used in live scores and announcements.
const copy: [string, string][] = [
['Звук','Sound'],['Громкость музыки','Music volume'],['Громкость эффектов (SFX)','Sound effects volume (SFX)'],
['Карты на столе. Наведите мышь или коснитесь карты для просмотра. Стрелки влево и вправо — выбрать карту, Escape — закрыть просмотр.','Cards on the table. Hover or touch a card to inspect it. Use Left and Right to choose a card, Escape to close.'],
['Игровой стол','Gaming table'],['Открыть меню','Open menu'],['Карты на столе','Cards on the table'],
['ВАШ БАЛАНС','YOUR BALANCE'],['ФИШЕК','CHIPS'],['БЛЕКДЖЕК','BLACKJACK'],
['Ну что, проверим твою удачу?','Shall we test your luck?'],['Загрузка стола…','Loading table…'],
['Последние результаты','Recent results'],['Ставки и действия','Bets and actions'],['Настроить ставку','Adjust bet'],['Настройка ставки','Bet settings'],
['СТАВКА','BET'],['Уменьшить ставку на 10','Decrease bet by 10'],['Увеличить ставку на 10','Increase bet by 10'],['Выбрать ставку','Choose bet'],['Максимальная ставка','Maximum bet'],['Ставка','Bet'],
['Ещё карту','Hit'],['ещё карту или хватит?','hit or stand?'],['Хватит','Stand'],['Удвоить','Double'],['Разделить','Split'],['Раздать карты','Deal cards'],['Новые фишки','New chips'],
['ГОТОВИМ СТОЛ','PREPARING TABLE'],['Блекджек за ночным карточным столом','Blackjack at a late-night card table'],
['Ваше место за столом.','Your seat at the table.'],['Готовим стол…','Preparing table…'],['Раскладываем карты','Laying out the cards'],['Только виртуальные фишки','Virtual chips only'],
['Закрыть','Close'],['За столом','At the table'],['Меню игры','Game menu'],['Звук выкл.','Sound off'],['Звук вкл.','Sound on'],['Настройки','Settings'],['Правила','Rules'],['Новая сессия','New session'],
['6 колод · блэкджек платит 3:2','6 decks · blackjack pays 3:2'],['Игра на виртуальные фишки','Play with virtual chips'],['Версия','Version'],['За этим столом','At this table'],
['Наберите больше дилера, но не больше 21. Туз стоит 1 или 11, картинки — 10.','Beat the dealer without going over 21. Aces count as 1 or 11; face cards count as 10.'],
['Шесть колод. Дилер останавливается на любой 17, включая мягкую.','Six decks. The dealer stands on all 17s, including soft 17.'],
['Блэкджек на первых двух картах платит 3:2. Обычная победа — 1:1, ничья возвращает ставку.','Blackjack on the first two cards pays 3:2. Other wins pay 1:1; a push returns your bet.'],
['Удвоение на двух картах: ставка ×2, затем ровно одна карта.','Double on two cards: double your bet and receive exactly one more card.'],
['Одинаковые ранги можно разделить до трёх рук при достаточном балансе. Тузам после разделения — по одной карте, без повторного разделения.','Split matching ranks into up to three hands if your balance allows. Split aces receive one card each and cannot be split again.'],
['21 после разделения считается обычной победой, а не блэкджеком.','21 after a split counts as a regular win, rather than blackjack.'],
['Страховки и сдачи нет. Ставки от 10 до 500 с шагом 10.','No insurance or surrender. Bets range from 10 to 500 in steps of 10.'],
['Клавиши: Enter — раздать, H — ещё карту, S — хватит, D — удвоить, P — разделить. Ставки блокируются во время раздачи.','Keys: Enter to deal, H to hit, S to stand, D to double, P to split. Bets are locked during a round.'],
['Баланс сохраняется после завершённой раздачи. При перезагрузке незавершённая раздача отменяется.','Your balance is saved after each completed round. Reloading cancels an unfinished round.'],
['В вашем темпе','At your own pace'],['Звуки стола','Table sounds'],['Анимации','Animations'],['Цветовой фильтр','Colour filter'],['Без фильтра','None'],['Зелёный','Green'],['Сепия','Sepia'],['Язык','Language'],['По региону','By region'],['Русский','Русский'],['Реплики Блекджек','Blackjack’s dialogue'],['Быстрая раздача','Fast dealing'],['Размер карт','Card size'],
['Системная настройка уменьшения движения учитывается автоматически. Все настройки сохраняются на этом устройстве.','Your system’s reduced-motion setting is respected automatically. All preferences are saved on this device.'],
['Начать новую сессию?','Start a new session?'],['Баланс станет равен 2 000 фишек, история сессии очистится.','Your balance will reset to 2,000 chips and the session history will be cleared.'],['Остаться','Keep playing'],
['Следующая раздача','Next round'],['Сдаём карты…','Dealing cards…'],['Выберите ставку и начните раздачу','Choose your bet and deal'],['Блекджек сдаёт карты…','Blackjack is dealing…'],['Посмотрим, что тебе достанется.','Let’s see what you get.'],['Ваш ход','Your turn'],['рука','hand'],[' из ',' of '],['Рискнёшь ещё раз?','Care to take another chance?'],['Ход дилера…','Dealer’s turn…'],['Теперь моя очередь.','My turn now.'],
['Блэкджек!','Blackjack!'],['Вы выиграли','You won'],['Проигрыш','Loss'],['Ничья — ставка возвращена','Push — bet returned'],
['Хм. На этот раз твоя взяла.','Hmm. You win this time.'],['Неплохо. Но вечер ещё не закончен.','Not bad. But the night isn’t over yet.'],['Забирай фишки. Пока везёт.','Take your chips. While your luck lasts.'],['Ха. Фишки остаются у меня.','Ha. I’ll keep the chips.'],['Дом умеет ждать. Ещё раз?','The house can wait. Another round?'],['Кажется, сегодня мой вечер.','Looks like tonight is my night.'],['На этот раз — поровну.','Even this time.'],['можно начать с новыми фишками','you can start with new chips'],
['РАЗДАЧА','ROUND'],['ПОСЛЕДНИЕ','RECENT'],['Победа','Win'],['Ничья','Push'],
['Не удалось завершить действие. Обновите страницу: незавершённая раздача отменится.','Could not complete the action. Reload the page; the unfinished round will be cancelled.'],
['За игровой стол','Take a seat'],['Не удалось подготовить стол. Попробуйте ещё раз.','Could not prepare the table. Please try again.'],['Повторить','Retry'],['Не удалось загрузить стол.','Could not load the table.'],['Проверьте соединение и обновите страницу.','Check your connection and reload the page.'],
['Дилер:','Dealer:'],['ДИЛЕР','DEALER'],['Рука','Hand'],['закрытая карта','face-down card'],['очков','points'],['фишек','chips'],
['ПОБЕДА','WIN'],['ПРОИГРЫШ','LOSS'],['ВОЗВРАТ','PUSH'],['БЛЭКДЖЕК','BLACKJACK'],['ПЕРЕБОР','BUST'],['МЯГКАЯ','SOFT'],['ВАША РУКА','YOUR HAND'],['РУКА','HAND'],['Ваша ставка','Your bet'],['Сделайте ставку','Place your bet'],['Блекджек уже ждёт вас за столом','Blackjack is waiting for you at the table'],
['четвёрка','four'],['девятка','nine'],['десятка','ten'],['восьмёрка','eight'],['семёрка','seven'],['шестёрка','six'],['пятёрка','five'],['тройка','three'],['двойка','two'],['король','king'],['валет','jack'],['дама','queen'],['туз','ace'],['Король','King'],['Валет','Jack'],['Дама','Queen'],['Туз','Ace'],['червей','of hearts'],['бубен','of diamonds'],['треф','of clubs'],['пик','of spades'],
].sort((a, b) => b[0].length - a[0].length) as [string, string][];
export function t(source: string): string {
  if (language === 'ru') return source;
  // One pass prevents replacements within already translated text.
  return source.replace(pattern, match => translations.get(match)!);
}
const translations = new Map(copy);
const pattern = new RegExp(copy.map(([key]) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
