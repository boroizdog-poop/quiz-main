# Đại chiến giáo trình

Mini game quiz CNXHKH: sinh viên người que mặc áo TMU đấu với boss giáo trình, theo phong cách ảnh thật cắt dán và nét vẽ tay.

## Chơi

Mở `index.html` bằng Chrome, Edge hoặc Firefox. Không cần cài thư viện hay build. Ảnh và âm thanh đều nằm trong dự án; chữ dùng Arial có sẵn trên máy để hiển thị dấu tiếng Việt đồng nhất, dùng được khi không có mạng.

- Bấm **Vào trận**, chọn đáp án bằng chuột hoặc phím **1–4**.
- Mỗi trận có đúng **3 câu**, thứ tự câu và A–D cố định như đề. Đáp án đúng lần lượt **1A, 2C, 3B**.
- Ba vũ khí ảnh thật (búa tạ khổng lồ, chảo gang phản lực và RPG) được bốc ngẫu nhiên, không trùng trong một trận.
- Màn chờ là bố cục **SINH VIÊN TMU — VS — GIÁO TRÌNH**, tên lớn phía trên hai nhân vật và nút **VÀO TRẬN** ở giữa bên dưới.
- Khi chuyển sang câu 2 và 3, sinh viên xoay một vòng để lấy vũ khí mới; đáp án chỉ mở sau cú xoay. RPG có tiếng lên đạn trước khi bắn, đại bác boss được phóng lớn.
- Đúng thì đánh boss mất 34 máu. Sai thì boss đánh bạn mất 34 máu.
- Đúng ít nhất **2/3 câu** để mở đòn kết liễu. Bấm **Tung đòn cuối**: nhân vật lấy đà, ném đạo cụ quá khổ, boss bị hất bay và quay khỏi màn hình.
- Kết quả có **Tái đấu** và **Xem lại đáp án**. Nhạc và hiệu ứng bắt đầu khi bấm **Vào trận**. Nút tắt/bật âm thanh ở góc dưới phải.
- Đấu trường phủ toàn viewport với ảnh sân trường TMU rõ màu. Máu hiển thị bằng 10 tim pixel.
- Hai nhân vật được phóng to, cao tối đa 480px và tự co theo phần không gian phía trên câu hỏi.
- Chữ câu hỏi 27–40px, đáp án 21–30px để trình chiếu; font Arial rõ dấu tiếng Việt. Đã bỏ thanh tiêu đề, bong bóng chat, dòng trạng thái / tên vũ khí dưới cùng và ảnh reaction ở giữa.
- Boss có ba chiêu ảnh cắt dán, bốc không trùng trong mỗi trận: đại bác bắn loạt điểm F, thả bom gây nổ, ném lọ độc tạo mây xanh. Mỗi chiêu gây tổng 34 máu.
- Cả sinh viên và boss đều nhuộm đỏ toàn thân trong khoảng 0,6 giây khi trúng đòn, kể cả ảnh mặt meme.
- Khi ra đòn hoặc trúng đòn, mặt nhân vật đổi sang meme ngẫu nhiên. Hai meme mới bạn thêm trong `assets/memes/` được ưu tiên xuất hiện đầu mỗi trận. Meme chỉ gắn trên mặt sinh viên và quyển sách. Chữ lớn chỉ hiện khi ra chiêu / trúng đòn.
- Người dùng bật giảm chuyển động trong hệ điều hành sẽ thấy phiên bản hiệu ứng rút gọn.

## Nội dung và ảnh

`script.js` giữ nguyên 3 câu hỏi gốc. `game.js` điều khiển lượt, đạo cụ, meme và hoạt ảnh. `sound.js` điều khiển nhạc nền / hiệu ứng từ các file MP3 cục bộ. `style.css` chứa bố cục đấu trường dành cho máy tính.

## Âm thanh

- Nhạc nền mặc định: **Monkeys Spinning Monkeys — Kevin MacLeod**, lựa chọn vui, tấu hài; chưa xác nhận tên nhạc trong video tham khảo. Nhạc được phát lặp xuyên suốt trận, hạ âm lượng lúc ra đòn để hiệu ứng rõ hơn.
- **♫ Nhạc**: chỉnh riêng âm lượng nhạc và hiệu ứng. Chỉ dùng bản nhạc nền sạch; file tham khảo được lưu để đối chiếu, không phát làm nhạc nền.
- Đầu trận và lúc đọc câu hỏi chỉ có nhạc nền. Hiệu ứng mới chỉ phát khi ra chiêu, trúng đòn, kết liễu; ngoại lệ là tiếng **yay** khi thắng. Đuôi tiếng đánh được ngân và nhỏ dần trong phần lời giải, rồi tắt nhẹ khi chuyển câu.
- Màn chờ trước **Vào trận** hoàn toàn im lặng, kể cả khi bật/tắt âm thanh. Nhạc và mọi hiệu ứng đều phát ở tốc độ gốc **1×**, giữ cao độ; không tăng tốc tiếng hét hoặc tiếng đánh.
- Búa tạ: vung từ trên xuống, **Doge Bonk**, sóng chấn động và đẩy boss lùi mạnh. Chảo gang: cầm đúng phía cán, phóng xoay boomerang, **Metal Bar**. RPG: giật lùi, đạn bay, vụ nổ lớn và **Goofy Bonk / Flashbang**.
- Đã bỏ tiếng hurt/oof cũ (tiếng người chơi gọi là “oops”); các tiếng meme, nhạc nền, vỡ kính, GET OUT và yay vẫn giữ nguyên.
- Hiệu ứng phát đủ bản gốc, bỏ các giới hạn cắt tiếng quá sớm. Đại bác dùng ba nhịp âm cách nhau 420ms thay vì dồn nhiều tiếng ngắn.
- Bom: tiếng nổ rồi **Flashbang** sau 300ms. Lọ độc: tiếng **kính vỡ** đúng lúc chạm người chơi, sau 220ms mới đến âm thanh thuốc Minecraft.
- Chỉ giảm tiếng nổ lúc sinh viên bắn RPG, boss thả bom và boss bắn đại bác khoảng 40%; các tiếng khác, gồm Flashbang và va chạm kết liễu, giữ nguyên âm lượng.
- Bom và RPG dùng quả cầu lửa cắt trực tiếp từ video tham khảo ở giây 41: nền trong suốt, lõi vàng trắng và viền cam; bung theo vài nhịp ảnh dán, không thêm quầng sáng CSS.
- Kết liễu phát lần lượt: **GET OUT!** → va chạm → **Disappearing Scream** khi boss bay đi → **yay** khi thắng; chờ tiếng trước kết thúc rồi mới phát tiếng sau.
- File nằm trong `assets/audio/`. Muốn thay tiếng, thay MP3 tương ứng; giữ tên file thì không cần sửa mã.
- Nhạc chỉ bắt đầu sau thao tác của người chơi. Tắt âm thanh sẽ dừng cả nhạc lẫn các tiếng đang phát; tái đấu không chồng thêm một bản nhạc nền.

Nguồn ảnh ở [assets/SOURCES.md](assets/SOURCES.md). Ảnh tải về phục vụ bản thử nghiệm; chưa xác lập quyền tái sử dụng để phát hành công khai. Không dùng ảnh AI. Áo và giày được cắt bằng clip path từ ảnh nguồn, tay chân và khuôn mặt là SVG.

## Kiểm tra

`reference/verify-game.cjs` chạy Chrome headless trên Windows với Node 22+:

```powershell
& 'C:/Program Files/nodejs/node.exe' reference/verify-game.cjs
```

Kiểm tra thứ tự cố định A–C–B, khóa chọn khi đang đánh, điểm, thắng/thua, xem lại đáp án, chơi lại, tim pixel, mặt meme, cả ba chiêu boss và hiệu ứng đỏ của hai nhân vật. Kiểm tra nhạc đầu trận không lẫn hiệu ứng, hiệu ứng không tràn sang lúc đọc câu hỏi, tắt/bật, hai thanh âm lượng, từng tiếng hiệu ứng và giải mã toàn bộ MP3 đang dùng để phát hiện file lỗi / im lặng. Kiểm tra cả khi mở trực tiếp `index.html`. Chỉ kiểm tra trên máy tính (1440×900, 1280×720 và 1024×768) theo yêu cầu. Kết quả và ảnh chụp nằm trong `shots/`.
