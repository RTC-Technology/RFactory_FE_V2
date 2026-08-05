export interface MenuItem {
  /** Mirrors the backend Menu.Id (numeric), stringified for template `track` usage. */
  id: string;
  label: string;
  /** Không bắt buộc — group/parent item không có route */
  route?: string;
  /** Inline SVG icon (optional, fallback về default circle icon) */
  icon?: string;
  /** Vị trí trong danh sách (dùng cho reorder) */
  order?: number;
  /** Menu.ParentId của backend, stringified. Vắng mặt = top-level. */
  parentId?: string;
  /** Menu.FunctionId của backend — quyền cần để thấy menu này (khi UserGroup rights được nối dây). */
  functionId?: string;
  /** Tooltip khi sidebar thu gọn */
  tooltip?: string;
  /** Children items — nếu có thì item này là group, không mở tab */
  children?: MenuItem[];
}
