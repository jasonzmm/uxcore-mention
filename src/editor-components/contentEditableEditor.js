import React from 'react';
import BaseEditor from './baseEditor';
import { parseStrByDelimiter } from '../utils/util';


// webkit browsers support 'plaintext-only'
const contentEditableValue = (() => {
  // only this format can solve `document is not defined` in nodejs
  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'PLAINTEXT-ONLY');
    return div.contentEditable === 'plaintext-only' ? 'plaintext-only' : true;
  }
  return true;
})();

export default class ContentEditableEditor extends BaseEditor {
  constructor(props) {
    super(props);
    this.state = {
      focus: false,
      value: props.value || props.defaultValue,
    };
  }
  componentDidMount() {
    this.STORE = {};
    if (this.state.value) {
      this.refs.editor.innerHTML = this.state.value;
    }
    const MutationObserver =
      window.MutationObserver || window.WebkitMutationObserver || window.MozMutationObserver;
    if (MutationObserver) {
      this.observer = new MutationObserver(this.onMutation.bind(this));
      this.observer.observe(this.refs.editor, {
        characterData: true,
        childList: true,
        subtree: true,
      });
    }
  }
  componentWillReceiveProps(nextProps) {
    if (nextProps.value !== this.props.value) {
      this.refs.editor.innerHTML = nextProps.value;
    }
  }
  componentWillUnmount() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
  handleEnterPress(e) {
    e.preventDefault();
    const editor = this.refs.editor;
    const sel = rangy.getSelection();
    const range = sel.getRangeAt(0);

    // make sure the last element of the editor is br
    // refer to: http://stackoverflow.com/questions/6023307/dealing-with-line-breaks-on-contenteditable-div
    if (!editor.lastChild ||
    editor.lastChild.nodeName.toLowerCase() !== 'br') {
      editor.appendChild(document.createElement('br'));
    }
    const nodeBr = document.createElement('br');
    range.deleteContents();
    range.insertNode(nodeBr);
    range.setStartAfter(nodeBr);
    sel.setSingleRange(range);
  }

  handleDefaultKeyup(e) {
    const { delimiter, matchRange } = this.props;
    const sel = rangy.getSelection();
    const range = sel.getRangeAt(0);
    if (range.commonAncestorContainer.nodeType === 3) {
      range.setStart(range.commonAncestorContainer, 0);
      const originStr = range.toString();
      const str = parseStrByDelimiter(originStr, delimiter);
      // send str to matcher
      this.props.matcher(str);
      if (str !== false) {
        // set range's start position before delimiter
        range.setStart(range.commonAncestorContainer, originStr.length - str.length - 1);
        const pos = range.getEndClientPos();
        // FIXME: ie8 will return error position in some case
        this.props.setCursorPos(pos);
        // save range position
        this.STORE.bookmark = range.getBookmark(range.commonAncestorContainer);
      }
    }
  }

  onInput() {
    if (!this.observer) {
      this.emitChange();
    }
  }
  onMutation(mutations) {
    this.emitChange(mutations);
  }
  onBlur() {
    this.emitChange();
    this.setState({
      focus: false,
    });
  }
  onFocus() {
    this.setState({
      focus: true,
    });
    this.props.onFocus(this);
  }
  insert(mentionContent) {
    const { editor } = this.refs;
    const sel = rangy.getSelection();
    if (this.STORE.bookmark) {
      const range = sel.getRangeAt(0);
      range.moveToBookmark(this.STORE.bookmark);
      const mentionNode = document.createElement('input');
      mentionNode.setAttribute('type', 'button');
      mentionNode.setAttribute('tabindex', '-1');
      mentionNode.className = `${this.props.prefixCls}-node`;
      mentionNode.value = mentionContent;
      // delete origin content in range
      range.deleteContents();
      range.insertNode(mentionNode);
      range.collapseAfter(mentionNode);
      range.select();
      setTimeout(() => {
        editor.focus();
      }, 0);
    }
  }
  extractContent() {
    // console.time('extractContent');
    const editor = this.refs.editor;
    const nodes = editor.childNodes;
    let content = '';
    for (let i = 0, len = nodes.length; i < len; i += 1) {
      const node = nodes[i];
      if (node.nodeType === 1) {
        const tagName = node.tagName.toLowerCase();
        if (tagName === 'input') {
          content += ` ${node.value} `;
        } else if (tagName === 'br') {
          content += '\n';
        }
      } else if (node.nodeType === 3) {
        content += node.textContent || node.nodeValue;
      }
    }
    // console.timeEnd('extractContent');
    return content;
  }
  emitChange(e) {
    if (!this.observer) {
      const editor = this.refs.editor;

      const lastHtml = this.lastHtml;
      const currentHtml = editor.innerHTML;
      if (lastHtml === currentHtml) {
        // no change made
        return;
      }
      this.lastHtml = currentHtml;
    }
    const content = this.extractContent();
    this.setState({
      value: content,
    });
    this.props.onChange(e, content);
  }
  render() {
    const { readOnly, placeholder } = this.props;
    const style = {
      width: this.props.width,
      height: this.props.height,
    };
    return (
      <div className={this.props.prefixCls}>
        <div className={`${this.props.prefixCls}-editor`} ref="editor"
          onKeyUp={this.onKeyup.bind(this)}
          onKeyDown={this.onKeydown.bind(this)}
          contentEditable={readOnly ? false : contentEditableValue}
          onInput={this.onInput.bind(this)}
          onBlur={this.onBlur.bind(this)}
          onFocus={this.onFocus.bind(this)}
          style={style}
        />
        {!this.state.focus && !this.state.value ? <div className={`${this.props.prefixCls}-placeholder`} onClick={() => {
          this.refs.editor.focus();
          this.onFocus();
        }}
        >{placeholder}</div> : ''}
      </div>
    );
  }
}
ContentEditableEditor.displayName = 'ContentEditableEditor';
ContentEditableEditor.propTypes = {
  /**
   * @i18n {zh-CN} class前缀
   * @i18n {en-US} class prefix
   */
  prefixCls: React.PropTypes.string,
  /**
   * @i18n {zh-CN} 编辑区域宽度
   * @i18n {en-US} editor's width
   */
  width: React.PropTypes.oneOfType([
    React.PropTypes.number,
    React.PropTypes.string,
  ]),
  /**
   * @i18n {zh-CN} 编辑区域高度
   * @i18n {en-US} editor's height
   */
  height: React.PropTypes.number,
  /**
   * @i18n {zh-CN} placeholder
   * @i18n {en-US} placeholder
   */
  placeholder: React.PropTypes.string,
  /**
   * @i18n {zh-CN} 自定义插入的mention内容
   * @i18n {en-US} customize the insert content with this function | function
   */
  mentionFormatter: React.PropTypes.func,
  /**
   * @i18n {zh-CN} 发生变化后的触发
   * @i18n {en-US} trigger when editor content change
   */
  onChange: React.PropTypes.func,
  /**
   * @i18n {zh-CN} 添加mention后触发
   * @i18n {en-US} Callback invoked when a mention has been added
   */
  onAdd: React.PropTypes.func,
  /**
   * @i18n {zh-CN} 默认内容
   * @i18n {en-US} default value
   */
  defaultValue: React.PropTypes.string,
  /**
   * @i18n {zh-CN} 内容
   * @i18n {en-US} value
   */
  value: React.PropTypes.string,
  /**
   * @i18n {zh-CN} 只读
   * @i18n {en-US} read only
   */
  readOnly: React.PropTypes.bool,
  /**
   * @i18n {zh-CN} 触发字符
   * @i18n {en-US} Defines the char sequence upon which to trigger querying the data source
   */
  delimiter: React.PropTypes.string,
};
ContentEditableEditor.defaultProps = {
  prefixCls: '',
  width: 200,
  height: 100,
  placeholder: '',
  mentionFormatter: data => `@${data.text}`,
  onChange: () => {},
  onAdd: () => {},
  defaultValue: '',
  readOnly: false,
  delimiter: '@',
};
