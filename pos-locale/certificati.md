# Il certificato del PC del Bistrot

La pagina del POS gira su `https://www.hoteltermeleonardo.com/pos`, quindi
il browser del palmare accetta di parlare col PC del Bistrot solo in HTTPS
con un certificato di cui si fida. Non c'e' un nome pubblico per un PC
sulla LAN: si fa una **CA privata dell'hotel**, si firma con quella il
certificato del PC, e si installa la CA sui palmari. Una volta sola.

## 1. Sul PC del Bistrot, in Git Bash (una volta)

Al posto di `192.168.0.50` va l'IP del PC sulla rete dell'hotel (deve
essere fisso: riservarlo nel router). La cartella e' `C:\pos`.

```bash
cd /c/pos
openssl genrsa -out ca.key 4096
openssl req -x509 -new -key ca.key -sha256 -days 3650 -subj "/CN=Hotel Terme Leonardo POS CA" -out ca.crt
openssl genrsa -out server.key 2048
openssl req -new -key server.key -subj "/CN=pos-bistrot" -out server.csr
printf "subjectAltName=IP:192.168.0.50,DNS:pos-bistrot\n" > san.txt
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 825 -sha256 -extfile san.txt -out server.crt
```

Cosa resta dove:

| file | dove va | chi lo vede |
|---|---|---|
| `ca.key` | solo sul PC del Bistrot, in `C:\pos` | nessun altro: chi lo ha puo' firmare certificati a nome dell'hotel |
| `ca.crt` | su ogni palmare | e' pubblico |
| `server.key`, `server.crt` | `C:\pos`, li legge `config.json` | il PC |

Niente di tutto questo entra nel repo (`.gitignore`: `pos-locale/*.key`,
`*.crt`, `*.csr`, `*.srl`, `*.sqlite*`, `config.json`).

## 2. Sui palmari Sunmi (Android)

Copiare `ca.crt` sul palmare (Bluetooth, o un link temporaneo dal PC) e:
Impostazioni → Sicurezza → Crittografia e credenziali → **Installa un
certificato** → **Certificato CA** → scegliere `ca.crt`. Android avvisa che
«la rete potrebbe essere monitorata»: e' la nostra CA, va bene.

Chrome sul palmare si fida delle CA installate dall'utente: la prova e'
aprire `https://192.168.0.50:8443/?a=stato-locale` e vedere la risposta
senza avvisi.

## 3. Nel palmare

Nella pagina del POS, schermata del PIN, **tocco lungo** sulla riga
«Server locale» in basso: indirizzo `https://192.168.0.50:8443`, locale
`bistrot`. Da quel momento il pallino in alto e' verde quando parla col
PC, ambra quando e' passato al cloud, rosso quando nessuno risponde e le
comande aspettano in coda.

## Scadenze

Il certificato del server dura 825 giorni (limite dei browser): nel 2028
si rifanno solo gli ultimi quattro comandi (da `server.key` in poi), la CA
sui palmari resta buona dieci anni.
