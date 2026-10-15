# Tracefolio — Product & Development Plan

> **Durum (2026-10-15):** v0.1.0 yayımlandı. İşaretli maddeler tamamlandı; işaretsizler yol haritasında.

> **Your work, continuously understood.** Yapay zekâyla gerçekleştirilen gerçek iş çıktılarını toplayan, doğrulayan ve yaşayan bir CV ile portföye dönüştüren açık kaynaklı araç.

- **Proje adı:** Tracefolio (geçici)
- **Kategori:** Open-source developer tool / AI career infrastructure
- **Yaklaşım:** Local-first, AI-provider-agnostic
- **Birincil hedef:** Kullanıcıların AI araçlarına entegre edebileceği, Git ile yönetilen bir kariyer hafızası oluşturmak.
- **Temel çıktı:** Güncel CV, proje portföyü ve kanıta dayalı kariyer profili.

---

## 1. Problem

Yazılım geliştiricileri ve diğer profesyoneller Claude, ChatGPT, Codex, Cursor ve benzeri yapay zekâ araçlarıyla giderek daha fazla iş üretiyor.

Ancak bu çalışmaların kariyer geçmişine aktarılması genellikle manuel yapılıyor.

- Projeler ve katkılar farklı araçlara dağılmış durumda.
- CV'ler güncel tutulmuyor.
- Yapay zekâyla üretilen işlerin gerçek katkısı belgelenmiyor.
- Portföy oluşturmak zaman alıyor.
- İş başvurularında somut kanıtlar yerine genel beceri ifadeleri kullanılıyor.
- Kullanıcı farklı AI araçları arasında geçiş yaparken kariyer bağlamını kaybedebiliyor.

### Fırsat

Kullanıcının gerçek iş çıktılarını sürekli toplayan, bunları doğrulanabilir kariyer verisine dönüştüren ve istenildiğinde CV veya portföy üreten taşınabilir bir sistem geliştirmek.

## 2. Ürün vizyonu

Tracefolio bir CV oluşturma SaaS'ı olmak zorunda değil.

Kullanıcı GitHub deposunu klonlar, kendi bilgisayarında yapılandırır ve desteklenen AI araçlarına entegre eder.

Sistem:

1. İş çıktılarını ve proje katkılarını kaydeder.
2. Git commit'lerini ve diğer kanıtları ilişkilendirir.
3. Becerileri ve kariyer deneyimlerini yapılandırır.
4. Kullanıcıya onaylatılabilir kariyer kayıtları oluşturur.
5. Güncel CV ve portföy üretir.
6. Farklı AI araçlarının aynı kariyer verisini kullanmasını sağlar.

**Ana ilke:** Kullanıcının AI ile geçirdiği zamanı değil, ortaya koyduğu gerçek değeri belgelemek.

## 3. Hedef kullanıcılar

### Birincil kullanıcılar

- AI araçlarıyla çalışan yazılım geliştiricileri
- Bağımsız geliştiriciler ve freelancer'lar
- Açık kaynak katkıcıları
- Teknik ürün geliştiricileri
- Portföyünü sürekli güncel tutmak isteyen profesyoneller

### İkincil kullanıcılar

- Tasarımcılar
- Veri analistleri
- Teknik yazarlar
- AI destekli iş akışları kullanan diğer profesyoneller

İlk MVP, Git ve proje dosyaları üzerinden ölçülebilir kanıt toplanabilen yazılım geliştiricilere odaklanacaktır.

## 4. Ürün prensipleri

1. **Local-first:** Kariyer verileri varsayılan olarak kullanıcının bilgisayarında kalır.
2. **AI-provider-agnostic:** Sistem tek bir AI sağlayıcısına bağımlı olmaz.
3. **Evidence-based:** Kariyer iddiaları mümkün olduğunda somut kanıtlarla ilişkilendirilir.
4. **User-controlled:** Kullanıcı verileri inceleyebilir, düzenleyebilir ve silebilir.
5. **Portable:** Veri standart dosyalarla taşınabilir.
6. **Privacy by default:** Gizli kodlar, kişisel veriler ve müşteri bilgileri izinsiz yayımlanmaz.
7. **No fabrication:** Ölçülmeyen başarı metrikleri veya doğrulanmamış deneyimler üretilmez.
8. **Beautiful output:** Oluşturulan CV ve portföy profesyonel, modern ve erişilebilir olmalıdır.

---

## 5. MVP kapsamı

### P0 — İlk sürüm için zorunlu

- [x] CLI ile proje başlatma
- [x] JSON tabanlı kariyer profili
- [x] Yapılandırılmış kariyer olayları
- [x] Git commit analizi
- [x] Kanıt ve iddia ilişkilendirme
- [x] Kullanıcı onay mekanizması
- [x] Markdown CV üretimi
- [x] Portföy verisi üretimi
- [x] Claude Code entegrasyonu
- [x] Codex entegrasyonu için ilk adaptör
- [x] README ve kurulum dokümantasyonu
- [x] Temel testler ve gizlilik kontrolleri

### P1 — İlk sürümden sonra

- [x] Animasyonlu web portföyü _(v0.1'de statik HTML olarak)_
- [ ] PDF CV üretimi
- [ ] Birden fazla CV şablonu
- [ ] İş ilanına göre CV uyarlama
- [x] Proje hikâyeleri ve vaka analizleri _(portföy proje sayfaları)_
- [ ] MCP sunucusu
- [ ] Ek AI araçları için adaptörler
- [ ] GitHub Actions entegrasyonu

### P2 — Uzun vadeli

- [ ] Farklı meslekler için kariyer modelleri
- [ ] Kariyer gelişimi ve beceri değişimi analizi
- [ ] Çoklu dil desteği
- [ ] İmzalı veya doğrulanabilir kanıt paketleri
- [ ] İsteğe bağlı barındırılan portföy
- [ ] Topluluk tarafından geliştirilen tema ve entegrasyonlar

---

## 6. Teknik mimari

### Önerilen teknoloji yığını

| Alan | Teknoloji |
| --- | --- |
| Dil | TypeScript |
| Runtime | Node.js |
| Monorepo | pnpm workspaces |
| Veri doğrulama | Zod |
| Kariyer verisi | JSON / JSONL |
| Git analizi | Git CLI ve gerektiğinde Git kütüphaneleri |
| CLI | Commander veya benzeri |
| Web portföyü | Astro |
| Stil | Tailwind CSS |
| Animasyon | Motion |
| Test | Vitest |
| AI entegrasyonu | Skills, talimat dosyaları ve uygun yerlerde MCP |

Teknolojiler ilk uygulama aşamasında doğrulanmalı ve ihtiyaç olmadan yeni bağımlılıklar eklenmemelidir.

### Mimari akış

```
AI tools / IDE agents
          |
          v
Skills and CLI
          |
          v
Career event schema <--- Git evidence collector
          |
          v
Local profile store
          |
          v
Claim and evidence engine
          |
          +------> Resume generator
          |
          +------> Portfolio generator
                         |
                         v
                  Static website
```

### Mimari kararlar

- Çekirdek, AI sağlayıcılarından bağımsız tutulur.
- AI adaptörleri ortak veri şemasını kullanır.
- Ham proje verileri ve kariyer iddiaları birbirinden ayrılır.
- Üretilen portföy statik dosyalar olarak yayınlanabilir.
- İlk sürümde veritabanı sunucusu ve kullanıcı hesabı sistemi zorunlu değildir.
- AI araçları yalnızca kendi izinleri ve entegrasyon mekanizmaları ölçüsünde veri okuyabilir veya yazabilir.

---

## 7. Monorepo yapısı

```
tracefolio/
├── apps/
│   └── portfolio/
├── packages/
│   ├── core/
│   ├── cli/
│   ├── git-adapter/
│   ├── generators/
│   └── integrations/
├── skills/
│   ├── capture-work/
│   ├── update-career/
│   └── generate-portfolio/
├── templates/
│   ├── resume/
│   └── portfolio/
├── profile/
│   ├── profile.json
│   └── events.jsonl
├── examples/
├── tests/
├── README.md
├── CONTRIBUTING.md
├── LICENSE
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

### Paketlerin sorumlulukları

- `core`: Şemalar, kariyer modeli, doğrulama ve kanıt ilişkileri.
- `cli`: Kullanıcının çalıştırdığı komutlar.
- `git-adapter`: Commit ve proje geçmişi analizi.
- `generators`: CV ve portföy verilerinin oluşturulması.
- `integrations`: AI araçlarına özgü adaptörler.
- `apps/portfolio`: Animasyonlu ve duyarlı portföy sitesi.
- `skills`: AI araçlarının kullanacağı iş akışı talimatları.
- `templates`: CV ve portföy tasarımları.

---

## 8. Kariyer veri modeli

Kariyer profili; beceriler, projeler, deneyimler, başarılar ve bunları destekleyen kanıtlardan oluşmalıdır.

### Örnek kariyer olayı

```json
{
  "id": "evt_001",
  "type": "project_contribution",
  "title": "API performansını iyileştirme",
  "summary": "Yanıt süresini azaltmak amacıyla önbellekleme uygulandı.",
  "skills": [
    "TypeScript",
    "API design",
    "Performance"
  ],
  "project": "example-api",
  "evidence": [
    {
      "type": "git_commit",
      "repository": "example-api",
      "commit": "abc1234"
    }
  ],
  "impact": {
    "metric": null,
    "verified": false
  },
  "status": "draft",
  "createdAt": "2026-10-15T12:00:00Z"
}
```

Bu kayıt yalnızca örnektir; gerçek projelerden elde edilmiş bir başarı iddiası değildir.

### Temel veri türleri

- `project`: Proje bilgisi
- `contribution`: Kullanıcının projeye katkısı
- `skill`: Beceri ve deneyim
- `achievement`: Başarı
- `evidence`: İddiaları destekleyen kanıt
- `experience`: İş veya profesyonel deneyim
- `career_event`: Zaman içinde oluşan kariyer olayı

### Kayıt durumları

- `draft`: Taslak
- `reviewed`: İncelenmiş
- `verified`: Belirli bir kanıtla doğrulanmış
- `published`: Kullanıcının yayımlamayı seçtiği kayıt
- `rejected`: Kullanıcı tarafından reddedilmiş

Doğrulama durumu her iddia için ayrı tutulmalı; bir projenin varlığı, projeyle ilgili her başarı iddiasını otomatik olarak doğrulamamalıdır.

---

## 9. CLI tasarımı

Hedeflenen kullanıcı deneyimi:

```bash
tracefolio init
tracefolio analyze
tracefolio update
tracefolio review
tracefolio build
tracefolio build --format markdown
tracefolio build --format pdf
tracefolio portfolio dev
```

### Komutların görevleri

- `init`: Profil ve yapılandırma dosyalarını oluşturur.
- `analyze`: Git geçmişini ve desteklenen proje kanıtlarını analiz eder.
- `update`: Yeni kariyer olayları hazırlar.
- `review`: Kullanıcının taslakları incelemesini sağlar.
- `build`: CV ve portföy çıktısını üretir.
- `portfolio dev`: Portföyü yerel geliştirme sunucusunda açar.

Bunlar hedeflenen komutlardır; uygulama geliştirilip test edilene kadar çalışır oldukları varsayılmamalıdır.

---

## 10. AI entegrasyon stratejisi

### Claude Code

- Proje bağlamına uygun skill ve talimat dosyaları
- İzin verilen iş çıktılarından kariyer olayları oluşturma
- Kullanıcı onayıyla profil güncelleme
- İlgili commit ve dosyalara kanıt bağlantıları ekleme

### OpenAI Codex

- Desteklenen skill ve talimat mekanizmalarını kullanma
- Aynı kariyer olayları şemasına kayıt üretme
- Ortak CLI ile profil güncelleme
- Entegrasyon davranışını testlerle doğrulama

### Diğer AI araçları

Yeni bir araç, ortak kariyer şemasına veri üreten veya bu veriyi tüketen bir adaptör ekleyerek desteklenebilir.

**Önemli sınırlama:** Her AI aracının tüm konuşmalarına erişim garanti edilemez. Otomatik veri toplama, her ortamın izin verdiği bağlamla sınırlı olmalıdır. ChatGPT web arayüzü, IDE ajanları ve yerel CLI araçları aynı entegrasyon yeteneklerine sahip değildir.

---

## 11. CV üretimi

CV üretimi yalnızca metin yazmaktan ibaret olmamalıdır.

### Hedeflenen çıktılar

- ATS uyumlu Markdown CV
- PDF CV
- HTML önizleme
- Belirli bir iş ilanına uyarlanmış CV
- Beceriler ve projeler özeti

### Kurallar

- Yalnızca kullanıcının onayladığı veya uygun şekilde doğruladığı bilgiler kullanılmalı.
- Ölçülmeyen metrikler eklenmemeli.
- Proje katkıları mümkün olduğunda kanıtlarla ilişkilendirilmeli.
- İş ilanına göre seçim yapılırken deneyim uydurulmamalı.
- Kullanıcı hangi kayıtların CV'ye gireceğini kontrol edebilmeli.

---

## 12. Portföy UI/UX

### Tasarım yönü

- Modern, premium ve editorial tasarım
- Koyu ve açık tema
- Güçlü tipografi
- Dengeli boşluk kullanımı
- Akıcı geçişler ve hafif parallax
- Mobil uyumlu düzen
- Erişilebilir animasyonlar
- Hızlı yüklenen statik sayfalar

### Ana sayfa

- Kişisel tanıtım
- Uzmanlık alanları
- Öne çıkan projeler
- Kariyer özeti
- İletişim ve sosyal bağlantılar

### Proje detay sayfası

Her proje aşağıdaki hikâyeyi sunabilir:

1. Problem
2. Kullanıcının sorumluluğu
3. Teknik yaklaşım
4. Uygulama
5. Sonuç
6. Kanıtlar ve bağlantılar

### CV Studio

İlk sürümde bağımsız bir editör uygulaması zorunlu değildir. Başlangıçta Markdown verisi ve statik web önizlemesi yeterlidir. Daha sonra canlı önizlemeli, şablon seçilebilir bir CV editörü eklenebilir.

### Animasyon ilkeleri

- Sayfa açılışlarında hafif giriş animasyonları
- Scroll tabanlı bölüm geçişleri
- Proje kartlarında mikro etkileşimler
- Kullanıcının hareket azaltma tercihini destekleme
- İçeriğin animasyon olmadan da anlaşılabilir olması

---

## 13. Gizlilik ve güvenlik

- Profil verileri varsayılan olarak yerelde saklanmalı.
- `.env`, API anahtarları ve gizli dosyalar kariyer çıktısına alınmamalı.
- Hassas dosyalar ve müşteri bilgileri otomatik yayımlanmamalı.
- Git commit mesajları ve kod içeriği tek başına kişisel başarı kanıtı kabul edilmemeli.
- Kullanıcı yayımlanacak içeriği inceleyebilmeli.
- Kanıt bağlantıları gizli depoların içeriğini istemeden açığa çıkarmamalı.
- AI tarafından oluşturulan iddialar doğrulanmış veri gibi sunulmamalı.
- Harici AI servislerine veri aktarımı açıkça belirtilmeli.

---

## 14. Geliştirme yol haritası

### Aşama 1 — Çekirdek

- [x] Monorepo altyapısı
- [x] TypeScript ve Zod modelleri
- [x] Profil yapılandırması
- [x] Kariyer olayı şeması
- [x] JSONL kayıt sistemi
- [x] Temel testler

### Aşama 2 — Git analizcisi

- [x] Commit geçmişini okuma
- [x] Repository bilgilerini toplama
- [x] Tekrarlanan kayıtları engelleme
- [x] Hassas dosya filtreleri
- [x] Kanıt referansları
- [x] Analiz sonuçlarını taslak olarak kaydetme

### Aşama 3 — AI entegrasyonları

- [x] Claude Code için ilk skill
- [x] Codex için ilk skill
- [x] Ortak veri şeması
- [x] Profil güncelleme iş akışı
- [x] Kullanıcı onayı
- [x] Entegrasyon testleri

### Aşama 4 — CV üretimi

- [x] Markdown şablonu
- [x] Deneyim ve beceri seçimi
- [x] Proje katkılarının düzenlenmesi
- [x] ATS uyumluluk kontrolleri
- [ ] PDF çıktısı _(v0.1: `resume.html` tarayıcıdan PDF'e yazdırılıyor; doğrudan PDF sonraki sürümde)_

### Aşama 5 — Portföy

- [ ] Astro uygulaması _(v0.1: bağımlılıksız statik HTML üreteci kullanıldı; Astro teması sonraki sürümde)_
- [x] Ana sayfa tasarımı
- [x] Proje detay sayfaları
- [x] Animasyonlar _(Motion kütüphanesi yerine CSS + IntersectionObserver; `prefers-reduced-motion` destekli)_
- [x] Duyarlı tasarım
- [x] Tema ve tipografi sistemi
- [x] Statik üretim

### Aşama 6 — Yayına hazırlık

- [x] Kurulum dokümantasyonu
- [x] Örnek profil
- [x] CONTRIBUTING rehberi
- [x] Lisans
- [x] Güvenlik kontrolleri
- [x] CI ve test otomasyonu
- [x] İlk GitHub sürümü

Tahmini süre: Tek geliştirici için yaklaşık iki hafta; kapsam ve entegrasyon zorluklarına göre değişebilir.

---

## 15. Başarı ölçütleri

İlk sürüm şu sorulara olumlu yanıt vermelidir:

- Yeni kullanıcı kurulumunu dokümantasyonla tamamlayabiliyor mu?
- Git geçmişinden anlamlı kariyer olayları oluşturulabiliyor mu?
- Yinelenen kayıtlar engelleniyor mu?
- Doğrulanmamış iddialar açıkça işaretleniyor mu?
- Kullanıcı kayıtları inceleyip düzeltebiliyor mu?
- CV tek komutla üretilebiliyor mu?
- Portföy yerel olarak çalıştırılabiliyor mu?
- Sistem bir AI sağlayıcısına bağımlı olmadan kullanılabiliyor mu?
- Hassas verilerin yanlışlıkla yayımlanması önleniyor mu?

---

## 16. Açık kaynak stratejisi

- İlk sürüm GitHub üzerinde yayımlanır.
- Kurulum ve katkı rehberi açık ve kısa tutulur.
- Örnek veri seti sahte ama gerçekçi verilerle hazırlanır.
- Entegrasyonlar bağımsız modüller olarak geliştirilir.
- Kullanıcıların kendi temalarını ve skill dosyalarını eklemesi desteklenir.
- İlk lisans tercihi MIT olabilir; nihai seçim yayın öncesinde yapılır.

---

## 17. İlk geliştirme görevi

İlk hedef, bütün ürünü bir defada geliştirmek değil, uçtan uca çalışan küçük bir akış oluşturmaktır.

**İlk milestone:** `Local Career Profile MVP`

1. Projeyi pnpm monorepo olarak kur.
2. TypeScript ve Zod ile kariyer veri modelini tanımla.
3. `tracefolio init` komutunu geliştir.
4. `tracefolio analyze` ile Git commit geçmişini oku.
5. Analiz sonuçlarını taslak kariyer olayları olarak kaydet.
6. `tracefolio review` ile taslakların incelenmesini sağla.
7. `tracefolio build` ile Markdown CV üret.
8. Testleri ve kurulum dokümantasyonunu ekle.

### İlk kabul kriteri

Temiz bir yerel Git deposunda birkaç commit bulunan kullanıcı, Tracefolio'yu kurabilmeli; analiz sonucunda kariyer olayları oluşturabilmeli; bunları inceleyip onayladıktan sonra Markdown CV üretebilmelidir.

Bu akış güvenilir biçimde çalıştıktan sonra AI entegrasyonları ve animasyonlu portföy eklenmelidir.

---

## 18. Uzun vadeli vizyon

Tracefolio, yalnızca CV üreten bir araç olmaktan çıkarak kişisel ve taşınabilir bir kariyer hafızasına dönüşebilir.

Kullanıcı hangi AI aracını kullanırsa kullansın, izin verdiği ölçüde aynı deneyim ve beceri profilini kullanabilir.

Bu sistemin temel değeri, yapay zekâyla yapılan her konuşmayı kaydetmek değil; **zaman içinde ortaya çıkan gerçek becerileri, projeleri ve katkıları kaybolmayan bir kariyer varlığına dönüştürmek** olacaktır.

**İlk öncelik:** Güvenilir veri modeli, yerel çalışma, kanıt toplama ve tek komutla CV üretimi.

**Sonraki öncelik:** AI entegrasyonları, animasyonlu portföy ve kişiselleştirilmiş başvuru deneyimi.
