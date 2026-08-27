<?php
declare(strict_types=1);

namespace App\Service;

use Hyperf\Contract\ConfigInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Merchant\MerchantPhoneIndex;
use Mtrip\Shared\Support\CryptoHelper;

/** 迁移专用批量索引器，不在查询请求中解密整表。输出仅计数。 */
class MerchantPhoneIndexService
{
    #[Inject]
    protected ConfigInterface $config;

    public function run(bool $apply = false): array
    {
        $key = (string) $this->config->get('mtrip.aes_key', '');
        $counts = ['indexed' => 0, 'invalid' => 0, 'concurrent' => 0];
        foreach (['merchant_info', 'merchant_application_business'] as $table) {
            $last = 0;
            do {
                $rows = Db::table($table)->where('id', '>', $last)->whereNull('contact_phone_index')
                    ->where('contact_phone', '<>', '')->orderBy('id')->limit(200)->get(['id', 'contact_phone']);
                foreach ($rows as $row) {
                    $last = (int) $row->id;
                    try {
                        $phone = CryptoHelper::decrypt((string) $row->contact_phone, $key);
                    } catch (\Mtrip\Shared\Exception\BusinessException) {
                        ++$counts['invalid'];
                        continue;
                    }
                    $hash = MerchantPhoneIndex::hash($phone, $key);
                    if ($hash === null) {
                        ++$counts['invalid'];
                        continue;
                    }
                    if ($apply && Db::table($table)->where('id', $row->id)->where('contact_phone', $row->contact_phone)
                        ->whereNull('contact_phone_index')->update(['contact_phone_index' => $hash, 'updated_at' => Db::raw('updated_at')]) === 0) {
                        ++$counts['concurrent'];
                    } else {
                        ++$counts['indexed'];
                    }
                }
            } while (count($rows) === 200);
        }
        return $counts;
    }
}
