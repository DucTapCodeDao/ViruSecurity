- Tên game: ViruSecurity
- Lấy cảm hứng từ Minesweeper
- Thay mine = virus và flag = warning
- Thuật toán:
	+ Dùng DFS để loang những ô xung quanh không có virus (giá trị = 0).
	+ Tạo 3 Mode tương ứng với 3 thuật toán khác nhau được sử dung:
		* Detective Mode: Dùng Backtracking kết hợp với Constraint Satisfaction Problem (CSP) để tạo ra map có thể giải hoàn toàn bằng suy luận mà không cần đoán bừa (100% não to).
		* Maze Mode: Từ góc trên bên trái, người chơi cần tìm con đường an toàn để đến góc dưới bên phải mà không giẫm phải virus. Số lượng virus tăng lên để giảm bớt số lượng đường đi có thể tìm được. Dùng Dijkstra và A* để tạo map.
		* Virus Zone Mode: Dùng DFS để tạo map có hình thù bất kỳ, không còn là hình chữ nhật.
- Tính năng:
	+ New Game.
	+ Chọn Mode.
	+ Lưu điểm của người chơi ở mỗi Mode. (optional)
	+ Bảng xếp hạng mỗi Mode. (optional)
	+ Chế độ Duel có bấm giờ để phân định thắng thua. (optional)
- Ngôn ngữ sử dung:
	+ Backend: NodeJS
	+ Frontend: Vue.js
	+ Database: MySQL
- Cách mở trò chơi:
	+ B1: Mở Terminal folder gốc.
	+ B2: "cd backend"
	+ B3: "node app.js"
	+ B4: Mở http://localhost:3000/health kiểm tra trạng thái trò chơi
	+ B5: Mở Live Server của file index.html
