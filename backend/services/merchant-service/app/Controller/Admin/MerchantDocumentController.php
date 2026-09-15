<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;

use App\Service\MerchantDocumentService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Support\Result;

class MerchantDocumentController extends AbstractController
{
    #[\Hyperf\Di\Annotation\Inject]
    protected \Hyperf\HttpServer\Contract\ResponseInterface $response;
    #[Permission('merchant:document:replace')]
    public function replace(): array
    {
        return Result::success((new MerchantDocumentService())->replace($this->requireId('docId'), $this->request->all(), $this->request->file('file')));
    }

    #[Permission('merchant:document:verify')]
    public function review(): array
    {
        return Result::success((new MerchantDocumentService())->review($this->requireId('docId'), $this->request->all()));
    }

    #[Permission('merchant:document:verify')]
    public function resubmit(): array
    {
        return Result::success((new MerchantDocumentService())->resubmit($this->requireId('docId'), $this->request->all()));
    }

    // Service authorizes independent M12 download, or module11 draft/verification access.
    public function download(): \Psr\Http\Message\ResponseInterface
    {
        $data = (new MerchantDocumentService())->download($this->requireId('docId'), $this->intInput('revisionId') ?: null);
        return $this->response->json(Result::success($data))->withHeader('Cache-Control', 'no-store, private')
            ->withHeader('Pragma', 'no-cache')->withHeader('X-Content-Type-Options', 'nosniff');
    }

    #[Permission('merchant:doc:list')]
    public function history(): array
    {
        $service = new MerchantDocumentService();
        $doc = $service->document($this->requireId('docId'));
        $history = Db::table('merchant_document_event')->where('doc_id', $doc['id'])->orderByDesc('id')->get()->map(static fn ($r) => (array) $r)->all();
        $revisions = Db::table('merchant_verify_document_revision')->where('doc_id', $doc['id'])->orderByDesc('id')->get()->map(static function ($r) {
            $row = (array) $r;
            $row['has_file'] = $row['file_url'] !== '';
            unset($row['file_url']);
            return $row;
        })->all();
        $doc['merchant_name'] = (string) Db::table('merchant_info')->where('id', $doc['merchant_id'])->value('merchant_name');
        $doc['application_no'] = '';
        if ((int) ($doc['application_id'] ?? 0) > 0) {
            $application = Db::table('merchant_application')->where('id', $doc['application_id'])->first();
            $doc['merchant_name'] = (string) ($application->company_name ?? $doc['merchant_name']);
            $doc['application_no'] = (string) ($application->app_no ?? '');
        }
        $doc['property_name'] = (int) ($doc['property_id'] ?? 0) > 0
            ? (string) Db::table('merchant_store')->where('id', $doc['property_id'])->value('store_name')
            : '';
        if ($doc['property_name'] === '' && (int) ($doc['application_business_id'] ?? 0) > 0) {
            $doc['property_name'] = (string) Db::table('merchant_application_business')
                ->where('id', $doc['application_business_id'])->where('application_id', $doc['application_id'])->value('business_name');
        }
        $doc['has_file'] = $doc['file_url'] !== '';
        unset($doc['file_url']);
        return Result::success(['document' => $doc, 'history' => $history, 'revisions' => $revisions]);
    }
}
