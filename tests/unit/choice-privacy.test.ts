import { expect, test } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChoiceChips } from '../../src/ui/ChoiceChips';

test('반을 고르는 라디오와 체크박스는 데이터 키를 HTML에 싣지 않는다', () => {
  const options = [{value:'private-class-key',label:'1반'}, {value:'another-class-key',label:'2반'}];
  for (const multiple of [false, true] as const) {
    const html = multiple
      ? renderToStaticMarkup(createElement(ChoiceChips, {legend:'담당 반', options, multiple:true, value:['private-class-key'], onChange:() => {}}))
      : renderToStaticMarkup(createElement(ChoiceChips, {legend:'반', options, value:'private-class-key', onChange:() => {}}));
    expect(html).toContain('1반');
    expect(html).toContain('checked');
    for (const option of options) expect(html).not.toContain(option.value);
  }
});
