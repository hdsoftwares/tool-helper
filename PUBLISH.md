# Hướng dẫn Publish Package Nội Bộ

## 📦 Cách 1: Publish qua Git (Đơn giản nhất)

### Setup

1. **Push code lên Git repository:**

```bash
git add .
git commit -m "v1.0.0: Initial release"
git tag v1.0.0
git push origin main
git push origin v1.0.0
```

2. **Các project khác cài đặt:**

```bash
npm install git+https://github.com/hd-software/tool-helper.git#v1.0.0
```

Hoặc thêm vào `package.json`:

```json
{
  "dependencies": {
    "@hd-software/tool-helper": "git+https://github.com/hd-software/tool-helper.git#v1.0.0"
  }
}
```

### Update Version

```bash
# Update version trong package.json
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0

# Git push với tag
git push origin main
git push origin --tags
```

## 🔐 Cách 2: Publish qua Private NPM Registry

### Setup Verdaccio (Local NPM Registry)

1. **Cài đặt Verdaccio:**

```bash
npm install -g verdaccio
```

2. **Khởi động Verdaccio:**

```bash
verdaccio
# Server chạy tại http://localhost:4873
```

3. **Cấu hình npm:**

```bash
npm set registry http://localhost:4873
```

4. **Publish package:**

```bash
npm publish
```

5. **Các project khác cài đặt:**

```bash
npm set registry http://localhost:4873
npm install @hd-software/tool-helper
```

### Setup Registry cho toàn công ty

1. **Deploy Verdaccio lên server nội bộ**

2. **Cấu hình npm trong mỗi máy:**

```bash
npm config set @hd-software:registry http://registry.hd-software.internal:4873
```

3. **Tạo file `.npmrc` trong project:**

```
@hd-software:registry=http://registry.hd-software.internal:4873
```

4. **Cài đặt:**

```bash
npm install @hd-software/tool-helper
```

## 🚀 Cách 3: Sử dụng GitHub Packages

### Setup

1. **Cấu hình package.json:**

```json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

2. **Login GitHub Packages:**

```bash
npm login --scope=@hd-software --registry=https://npm.pkg.github.com
# Username: <your-github-username>
# Password: <your-github-personal-access-token>
```

3. **Publish:**

```bash
npm publish
```

4. **Các project khác cài đặt:**

Tạo file `.npmrc` trong project:

```
@hd-software:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

```bash
npm install @hd-software/tool-helper
```

## 📋 Checklist trước khi publish

- [ ] Cập nhật version trong `package.json`
- [ ] Cập nhật CHANGELOG.md (nếu có)
- [ ] Test package hoạt động đúng
- [ ] Commit và push code lên Git
- [ ] Tạo Git tag với version
- [ ] Publish lên registry

## 🔄 Cập nhật Version

### Semantic Versioning

- **PATCH (1.0.0 → 1.0.1):** Fix bugs nhỏ
- **MINOR (1.0.0 → 1.1.0):** Thêm features mới (backward compatible)
- **MAJOR (1.0.0 → 2.0.0):** Breaking changes

### Commands

```bash
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0

# Hoặc chỉnh sửa trực tiếp trong package.json
```

## 🔍 Xem phiên bản đã publish

### Git

```bash
git tag -l
```

### Private NPM Registry

```bash
npm view @hd-software/tool-helper versions
npm view @hd-software/tool-helper version
```

## 🎯 Khuyến nghị

- **Development:** Sử dụng Git-based installation (Cách 1)
- **Production:** Sử dụng Private NPM Registry (Cách 2) hoặc GitHub Packages (Cách 3)
